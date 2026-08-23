import assert from "node:assert/strict";
import { test } from "node:test";

function makeUsers(...users) {
  const list = [...users];
  list.get = (id) => list.find((user) => user.id === id);
  return list;
}

test("Treat Wounds public summary reports actual healing, degree, and immunity", async () => {
  const oldGame = globalThis.game;
  const oldConst = globalThis.CONST;
  const oldFromUuid = globalThis.fromUuid;
  const oldChat = globalThis.ChatMessage;
  const oldRoll = globalThis.Roll;
  try {
    globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { LIMITED: 1, OWNER: 3 } };
    const gm = { id: "gm", isGM: true, active: true };
    const sourceActor = { uuid: "Actor.healer", name: "Kikus", documentName: "Actor" };
    const immunityItem = {
      isExpired: false,
      flags: {
        "pf2e-action-forge": {
          immunity: {
            actionId: "treat-wounds",
            sourceSpecific: false,
            sourceActorUuid: sourceActor.uuid,
            expiresAtWorldTime: 4600
          }
        }
      }
    };
    const targetActor = {
      uuid: "Actor.patient",
      name: "Eldrak",
      documentName: "Actor",
      items: [immunityItem],
      system: { attributes: { hp: { value: 45, max: 50, temp: 0 } } },
      getActiveTokens: () => [],
      update: async (changes) => {
        if (Number.isFinite(changes["system.attributes.hp.value"])) {
          targetActor.system.attributes.hp.value = changes["system.attributes.hp.value"];
        }
      }
    };

    const transaction = {
      id: "tx-summary",
      actionId: "treat-wounds",
      sourceActorUuid: sourceActor.uuid,
      sourceActorName: sourceActor.name,
      targetActorUuid: targetActor.uuid,
      targetActorName: targetActor.name,
      targetSource: "picker",
      outcome: "criticalSuccess",
      difficultyClass: 15,
      createdBy: gm.id
    };
    const applicationFlag = {
      transaction,
      applied: {
        "treat-wounds-immunity": {
          at: Date.now(), by: gm.id, changed: true, expiresAtWorldTime: 4600
        }
      }
    };
    const sourceMessage = {
      id: "result-card",
      flags: { "pf2e-action-forge": { application: applicationFlag } },
      update: async (changes) => {
        const applied = changes["flags.pf2e-action-forge.application.applied"];
        if (applied) applicationFlag.applied = applied;
        const summary = changes["flags.pf2e-action-forge.application.summary"];
        if (summary) applicationFlag.summary = summary;
      }
    };

    const createdMessages = [];
    globalThis.ChatMessage = class {
      static getSpeaker({ alias } = {}) { return { alias }; }
      static async create(data) {
        createdMessages.push(data);
        return { id: `summary-${createdMessages.length}`, ...data };
      }
    };
    globalThis.Roll = class {
      constructor(formula) { this.formula = formula; this.total = null; }
      async evaluate() { this.total = 18; return this; }
    };

    const users = makeUsers(gm);
    globalThis.game = {
      user: gm,
      users,
      time: { worldTime: 1000 },
      messages: { get: (id) => id === sourceMessage.id ? sourceMessage : null },
      actors: [],
      scenes: { get: () => null },
      i18n: {
        localize: (key) => ({
          "PF2EActionForge.Roll.Outcome.criticalSuccess": "Kritischer Erfolg",
          "PF2EActionForge.TreatWounds.PublicSummary.Title": "Wunden versorgen"
        }[key] ?? key),
        format: (key, data) => {
          const templates = {
            "PF2EActionForge.TreatWounds.PublicSummary.Healed": "{source} hat {target} um {amount} TP geheilt.",
            "PF2EActionForge.TreatWounds.PublicSummary.Immunity": "{target} ist nun {duration} lang gegen Wunden versorgen immun.",
            "PF2EActionForge.TreatWounds.Duration.Hour": "{value} Stunde"
          };
          return (templates[key] ?? key).replace(/\{(\w+)\}/g, (_match, name) => String(data?.[name] ?? ""));
        }
      }
    };
    globalThis.fromUuid = async (uuid) => uuid === sourceActor.uuid ? sourceActor : uuid === targetActor.uuid ? targetActor : null;

    const canonical = await import("../scripts/core/action-registry.js");
    const { CORE_ACTIONS } = await import(`../scripts/data/core-action-catalog.js?summary-catalog=${Date.now()}`);
    if (!canonical.actionRegistry.has("treat-wounds")) {
      canonical.actionRegistry.register(CORE_ACTIONS.find((action) => action.id === "treat-wounds"));
    }

    const { ApplicationBroker } = await import(`../scripts/core/application-broker.js?summary-broker=${Date.now()}`);
    const broker = new ApplicationBroker();
    const result = await broker.request({
      messageId: sourceMessage.id,
      transactionId: transaction.id,
      effectId: "healing"
    });

    assert.equal(result.ok, true);
    assert.equal(result.application.value, 18, "rolled healing remains available for audit");
    assert.equal(result.application.appliedValue, 5, "summary uses actual HP restored after capping at max HP");
    assert.equal(targetActor.system.attributes.hp.value, 50);
    assert.equal(createdMessages.length, 1);
    assert.match(createdMessages[0].content, /Kikus hat Eldrak um 5 TP geheilt\./);
    assert.match(createdMessages[0].content, /Kritischer Erfolg/);
    assert.match(createdMessages[0].content, /Eldrak ist nun 1 Stunde lang gegen Wunden versorgen immun\./);
    assert.equal(applicationFlag.summary.messageId, "summary-1");

    const second = await broker.request({
      messageId: sourceMessage.id,
      transactionId: transaction.id,
      effectId: "healing"
    });
    assert.equal(second.ok, true);
    assert.equal(second.alreadyApplied, true);
    assert.equal(createdMessages.length, 1, "duplicate clicks must not create duplicate public summaries");
  } finally {
    globalThis.game = oldGame;
    globalThis.CONST = oldConst;
    globalThis.fromUuid = oldFromUuid;
    globalThis.ChatMessage = oldChat;
    globalThis.Roll = oldRoll;
  }
});
