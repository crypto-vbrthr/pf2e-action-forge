import assert from "node:assert/strict";
import { test } from "node:test";

const importFresh = async (path, tag) => import(`${path}?${tag}=${Date.now()}-${Math.random()}`);

test("Demoralize is executable and declares frightened plus source-specific 10-minute immunity", async () => {
  const { CORE_ACTIONS } = await importFresh("../scripts/data/core-action-catalog.js", "demoralize-catalog");
  const action = CORE_ACTIONS.find((entry) => entry.id === "demoralize");
  assert.ok(action);
  assert.equal(action.execution.enabled, true);
  assert.equal(action.execution.statistic, "intimidation");
  assert.equal(action.dc.strategy, "target-defense");
  assert.equal(action.dc.defense, "will");
  assert.equal(action.application.blockIfImmuneActionId, "demoralize");

  const critical = action.application.outcomes.criticalSuccess;
  const success = action.application.outcomes.success;
  const failure = action.application.outcomes.failure;
  const criticalFailure = action.application.outcomes.criticalFailure;

  assert.deepEqual(critical.find((effect) => effect.type === "condition-add"), {
    id: "frightened-2",
    type: "condition-add",
    condition: "frightened",
    value: 2,
    target: "target",
    label: "PF2EActionForge.Demoralize.ApplyFrightened2"
  });
  assert.equal(success.find((effect) => effect.type === "condition-add")?.value, 1);

  for (const outcome of [critical, success, failure, criticalFailure]) {
    const immunity = outcome.find((effect) => effect.type === "immunity");
    assert.ok(immunity, "every Demoralize outcome must apply temporary immunity");
    assert.equal(immunity.actionId, "demoralize");
    assert.equal(immunity.durationSeconds, 600);
    assert.equal(immunity.sourceSpecific, true);
    assert.equal(immunity.mode, "auto");
  }
});

test("Action Registry preserves valued condition application metadata", async () => {
  const { ActionRegistry } = await importFresh("../scripts/core/action-registry.js", "demoralize-registry");
  const registry = new ActionRegistry();
  const action = registry.register({
    id: "valued-condition-test",
    label: "Test",
    application: {
      outcomes: {
        success: [{ id: "frightened", type: "condition-add", condition: "frightened", value: 2 }]
      }
    }
  });
  assert.equal(action.application.outcomes.success[0].value, 2);
});

test("Application Engine creates Frightened with the requested value", async () => {
  const oldGame = globalThis.game;
  try {
    globalThis.game = {
      pf2e: {
        ConditionManager: {
          getCondition: () => ({
            toObject: () => ({ _id: "template", type: "condition", system: { value: { isValued: true, value: 1 } }, flags: {} })
          })
        }
      }
    };
    const created = [];
    const targetActor = {
      conditions: { bySlug: () => [] },
      isImmuneTo: () => false,
      createEmbeddedDocuments: async (_type, sources) => {
        created.push(...sources);
        return [{ id: "frightened-created" }];
      }
    };
    const { ApplicationEngine } = await importFresh("../scripts/core/application-engine.js", "demoralize-create");
    const engine = new ApplicationEngine();
    const result = await engine.apply({
      effect: { id: "frightened-2", type: "condition-add", condition: "frightened", value: 2 },
      targetActor,
      sourceActor: { uuid: "Actor.source" },
      transactionId: "tx-demoralize"
    });
    assert.equal(result.ok, true);
    assert.equal(result.value, 2);
    assert.equal(created[0].system.value.value, 2);
  } finally {
    globalThis.game = oldGame;
  }
});

test("Application Engine raises a lower Frightened value and never lowers a higher one", async () => {
  const oldGame = globalThis.game;
  try {
    globalThis.game = { pf2e: { ConditionManager: { getCondition: () => null } } };
    const updates = [];
    const existing = {
      id: "condition-existing",
      value: 1,
      system: { value: { value: 1 } },
      update: async (changes) => {
        updates.push(changes);
        existing.value = changes["system.value.value"];
        existing.system.value.value = existing.value;
      }
    };
    const targetActor = { conditions: { bySlug: () => [existing] } };
    const { ApplicationEngine } = await importFresh("../scripts/core/application-engine.js", "demoralize-update");
    const engine = new ApplicationEngine();

    const raised = await engine.apply({
      effect: { id: "frightened-2", type: "condition-add", condition: "frightened", value: 2 },
      targetActor
    });
    assert.equal(raised.ok, true);
    assert.equal(raised.changed, true);
    assert.deepEqual(updates, [{ "system.value.value": 2 }]);

    const notLowered = await engine.apply({
      effect: { id: "frightened-1", type: "condition-add", condition: "frightened", value: 1 },
      targetActor
    });
    assert.equal(notLowered.ok, true);
    assert.equal(notLowered.changed, false);
    assert.equal(existing.value, 2);
    assert.equal(updates.length, 1);
  } finally {
    globalThis.game = oldGame;
  }
});

test("Demoralize immunity is source-specific and expires after ten minutes of world time", async () => {
  const oldGame = globalThis.game;
  try {
    globalThis.game = {
      time: { worldTime: 1000 },
      i18n: { localize: (key) => key }
    };
    const items = [];
    const targetActor = {
      items,
      createEmbeddedDocuments: async (_type, sources) => {
        const created = sources.map((source, index) => ({ ...source, id: `effect-${index + 1}` }));
        items.push(...created);
        return created;
      }
    };
    const sourceA = { uuid: "Actor.a" };
    const sourceB = { uuid: "Actor.b" };
    const { ApplicationEngine } = await importFresh("../scripts/core/application-engine.js", "demoralize-immunity-engine");
    const { getActiveActionImmunity } = await importFresh("../scripts/core/action-immunity.js", "demoralize-immunity-read");
    const engine = new ApplicationEngine();

    const applied = await engine.apply({
      effect: {
        id: "demoralize-immunity",
        type: "immunity",
        actionId: "demoralize",
        durationSeconds: 600,
        sourceSpecific: true,
        name: "Immune: Demoralize"
      },
      targetActor,
      sourceActor: sourceA,
      transactionId: "tx-immune"
    });
    assert.equal(applied.ok, true);
    assert.equal(applied.expiresAtWorldTime, 1600);
    assert.ok(getActiveActionImmunity(targetActor, "demoralize", { sourceActor: sourceA }));
    assert.equal(getActiveActionImmunity(targetActor, "demoralize", { sourceActor: sourceB }), null);

    globalThis.game.time.worldTime = 1600;
    assert.equal(getActiveActionImmunity(targetActor, "demoralize", { sourceActor: sourceA }), null);
  } finally {
    globalThis.game = oldGame;
  }
});
