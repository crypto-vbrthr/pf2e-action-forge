import assert from "node:assert/strict";
import { test } from "node:test";

function actorWithMedicine(rank) {
  return {
    skills: { medicine: { rank } },
    getStatistic: (slug) => slug === "medicine" ? { rank } : null
  };
}

test("Treat Wounds is enabled with proficiency-aware DC choices and secure result definitions", async () => {
  const { CORE_ACTIONS } = await import(`../scripts/data/core-action-catalog.js?treat-catalog=${Date.now()}`);
  const { ActionRegistry } = await import(`../scripts/core/action-registry.js?treat-registry=${Date.now()}`);
  const raw = CORE_ACTIONS.find((action) => action.id === "treat-wounds");
  assert.ok(raw);
  assert.equal(raw.execution.enabled, true);
  assert.equal(raw.execution.statistic, "medicine");
  assert.equal(raw.execution.mode, "statistic");
  assert.equal(raw.execution.minRank, 1);
  assert.equal(raw.application.blockIfImmuneActionId, "treat-wounds");

  const registry = new ActionRegistry();
  const action = registry.register(raw);
  assert.deepEqual(action.dc.choices.map((choice) => choice.value), [15, 20, 30, 40]);
  assert.deepEqual(action.dc.choices.map((choice) => choice.minRank), [1, 2, 3, 4]);
  assert.equal(action.application.outcomes.success.find((e) => e.id === "healing").formulaByDc["20"], "2d8+10");
  assert.equal(action.application.outcomes.criticalSuccess.find((e) => e.id === "healing").formulaByDc["40"], "4d8+50");
  assert.equal(action.application.outcomes.criticalFailure.find((e) => e.id === "damage").formula, "1d8");

  for (const outcome of ["criticalSuccess", "success", "failure", "criticalFailure"]) {
    const immunity = action.application.outcomes[outcome].find((effect) => effect.id === "treat-wounds-immunity");
    assert.ok(immunity, `${outcome} should grant Treat Wounds immunity`);
    assert.equal(immunity.durationSeconds, 3600);
    assert.equal(immunity.mode, "auto");
  }
});

test("fixed-choice DC resolver exposes only Treat Wounds DCs supported by Medicine proficiency", async () => {
  const oldGame = globalThis.game;
  try {
    globalThis.game = { user: { isGM: false } };
    const { CORE_ACTIONS } = await import(`../scripts/data/core-action-catalog.js?treat-dc-catalog=${Date.now()}`);
    const { DCResolver } = await import(`../scripts/core/dc-resolver.js?treat-dc=${Date.now()}`);
    const action = CORE_ACTIONS.find((entry) => entry.id === "treat-wounds");
    const resolver = new DCResolver();
    const targetState = { targets: [{ actor: { uuid: "Actor.patient" } }] };

    const expected = new Map([
      [1, [15]],
      [2, [15, 20]],
      [3, [15, 20, 30]],
      [4, [15, 20, 30, 40]]
    ]);

    for (const [rank, choices] of expected) {
      const state = resolver.getState(action, targetState, { actor: actorWithMedicine(rank), statistic: "medicine" });
      assert.deepEqual(state.choices, choices);
      assert.equal(state.difficultyClass, 15);
    }

    const expert = resolver.resolve(action, targetState, {
      actor: actorWithMedicine(2),
      statistic: "medicine",
      manualDc: 20
    });
    assert.equal(expert.ok, true);
    assert.equal(expert.difficultyClass, 20);

    const illegal = resolver.resolve(action, targetState, {
      actor: actorWithMedicine(1),
      statistic: "medicine",
      manualDc: 40
    });
    assert.equal(illegal.ok, true);
    assert.equal(illegal.difficultyClass, 15, "an unsupported higher DC must fall back to the first legal treatment DC");
  } finally {
    globalThis.game = oldGame;
  }
});

test("Treat Wounds formulas resolve from the recorded transaction DC and apply HP changes", async () => {
  const oldGame = globalThis.game;
  const oldRoll = globalThis.Roll;
  try {
    globalThis.game = { pf2e: { settings: { variants: { stamina: false } } } };
    const totals = new Map([["2d8+10", 21], ["1d8", 6]]);
    globalThis.Roll = class {
      constructor(formula) { this.formula = formula; this.total = null; }
      async evaluate() { this.total = totals.get(this.formula) ?? 0; return this; }
    };

    const { ApplicationEngine, resolveFormula } = await import(`../scripts/core/application-engine.js?treat-engine=${Date.now()}`);
    const engine = new ApplicationEngine();
    const healing = {
      id: "healing",
      type: "heal",
      formulaByDc: { 15: "2d8", 20: "2d8+10", 30: "2d8+30", 40: "2d8+50" }
    };
    const transaction = { difficultyClass: 20 };
    assert.equal(resolveFormula(healing, transaction), "2d8+10");

    const updates = [];
    const targetActor = {
      system: { attributes: { hp: { value: 30, max: 50, temp: 0 } } },
      getActiveTokens: () => [],
      update: async (data) => updates.push(data)
    };
    const result = await engine.apply({ effect: healing, targetActor, transaction });
    assert.equal(result.ok, true);
    assert.equal(result.value, 21);
    assert.equal(result.formula, "2d8+10");
    assert.equal(updates[0]["system.attributes.hp.value"], 50, "healing is capped at maximum HP");

    const damageUpdates = [];
    const damageActor = {
      system: { attributes: { hp: { value: 20, max: 30, temp: 2 } } },
      getActiveTokens: () => [],
      update: async (data) => damageUpdates.push(data)
    };
    const damage = await engine.apply({ effect: { id: "damage", type: "damage", formula: "1d8" }, targetActor: damageActor });
    assert.equal(damage.ok, true);
    assert.equal(damage.value, 6);
    assert.equal(damageUpdates[0]["system.attributes.hp.temp"], 0);
    assert.equal(damageUpdates[0]["system.attributes.hp.value"], 16);
  } finally {
    globalThis.game = oldGame;
    globalThis.Roll = oldRoll;
  }
});

test("Treat Wounds immunity is a timed PF2e effect and expires against Foundry world time", async () => {
  const oldGame = globalThis.game;
  try {
    globalThis.game = {
      time: { worldTime: 1_000 },
      i18n: { localize: (key) => key }
    };
    const { ApplicationEngine } = await import(`../scripts/core/application-engine.js?treat-immunity-engine=${Date.now()}`);
    const { getActiveActionImmunity } = await import(`../scripts/core/action-immunity.js?treat-immunity=${Date.now()}`);
    const engine = new ApplicationEngine();
    const items = [];
    const targetActor = {
      items,
      createEmbeddedDocuments: async (_type, sources) => {
        const created = sources.map((source, index) => ({ ...source, id: `effect-${index}`, isExpired: false }));
        items.push(...created);
        return created;
      }
    };
    const sourceActor = { uuid: "Actor.healer" };
    const effect = {
      id: "treat-wounds-immunity",
      type: "immunity",
      actionId: "treat-wounds",
      durationSeconds: 3600,
      sourceSpecific: false,
      name: "PF2EActionForge.TreatWounds.ImmunityName",
      description: "PF2EActionForge.TreatWounds.ImmunityDescription"
    };

    const applied = await engine.apply({ effect, targetActor, sourceActor, transactionId: "tx-treat" });
    assert.equal(applied.ok, true);
    assert.equal(applied.expiresAtWorldTime, 4_600);
    assert.equal(items.length, 1);
    assert.equal(items[0].type, "effect");
    assert.equal(items[0].system.duration.unit, "minutes");
    assert.equal(items[0].system.duration.value, 60);
    assert.equal(items[0].flags["pf2e-action-forge"].immunity.actionId, "treat-wounds");

    let active = getActiveActionImmunity(targetActor, "treat-wounds", { sourceActor });
    assert.ok(active);
    assert.equal(active.remainingSeconds, 3600);

    globalThis.game.time.worldTime = 4_599;
    active = getActiveActionImmunity(targetActor, "treat-wounds", { sourceActor });
    assert.equal(active.remainingSeconds, 1);

    globalThis.game.time.worldTime = 4_600;
    assert.equal(getActiveActionImmunity(targetActor, "treat-wounds", { sourceActor }), null);
  } finally {
    globalThis.game = oldGame;
  }
});

test("application chat automatically requests intrinsic Treat Wounds immunity while keeping a fallback button", async () => {
  const oldGame = globalThis.game;
  const oldChat = globalThis.ChatMessage;
  try {
    globalThis.game = {
      i18n: {
        localize: (key) => key,
        format: (key, data) => `${key}:${data?.target ?? ""}`
      }
    };
    let createdData = null;
    globalThis.ChatMessage = class {
      static getSpeaker() { return { alias: "Healer" }; }
      static async create(data) {
        createdData = data;
        return { id: "message-auto", ...data };
      }
    };

    const brokerModule = await import("../scripts/core/application-broker.js");
    const oldRequest = brokerModule.applicationBroker.request;
    const requests = [];
    brokerModule.applicationBroker.request = async (request) => {
      requests.push(request);
      return { ok: true, application: { changed: true } };
    };

    try {
      const { ApplicationChat } = await import(`../scripts/core/application-chat.js?treat-chat=${Date.now()}`);
      const chat = new ApplicationChat();
      const definition = {
        id: "treat-wounds",
        label: "PF2EActionForge.Actions.TreatWounds.Name",
        application: {
          outcomes: {
            success: [
              { id: "healing", type: "heal", formula: "2d8", label: "Heal" },
              { id: "immunity", type: "immunity", mode: "auto", actionId: "treat-wounds", durationSeconds: 3600, label: "Immune" }
            ]
          }
        }
      };
      const transaction = {
        id: "tx-auto",
        outcome: "success",
        sourceActorName: "Healer",
        targetActorUuid: "Actor.patient",
        targetActorName: "Patient"
      };

      const message = await chat.create({ definition, transaction });
      assert.equal(message.id, "message-auto");
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.deepEqual(requests, [{ messageId: "message-auto", transactionId: "tx-auto", effectId: "immunity" }]);
      assert.match(createdData.content, /data-effect-id="immunity"/, "automatic effect keeps a manual fallback control");
      assert.match(createdData.content, /data-effect-id="healing"/);
    } finally {
      brokerModule.applicationBroker.request = oldRequest;
    }
  } finally {
    globalThis.game = oldGame;
    globalThis.ChatMessage = oldChat;
  }
});
