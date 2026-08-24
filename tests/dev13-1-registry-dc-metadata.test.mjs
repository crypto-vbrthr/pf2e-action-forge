import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

async function registeredCatalog() {
  const nonce = `${Date.now()}-${Math.random()}`;
  const { CORE_ACTIONS } = await import(`../scripts/data/core-action-catalog.js?dev13-1-catalog=${nonce}`);
  const { ActionRegistry } = await import(`../scripts/core/action-registry.js?dev13-1-registry=${nonce}`);
  const registry = new ActionRegistry();
  registry.registerMany(CORE_ACTIONS);
  return registry;
}

test("ActionRegistry preserves hidden DC metadata for registered Earn Income", async () => {
  const registry = await registeredCatalog();
  const action = registry.get("earn-income");
  assert.ok(action);
  assert.equal(action.dc.strategy, "gm-defined");
  assert.equal(action.dc.allowUnknown, true);
  assert.equal(action.dc.hidden, true);
  assert.equal(Object.isFrozen(action.dc), true);
});

test("ActionRegistry preserves Learn a Spell custom fixed-choice metadata and labels", async () => {
  const registry = await registeredCatalog();
  const action = registry.get("learn-a-spell");
  assert.ok(action);
  assert.equal(action.dc.strategy, "fixed-choice");
  assert.equal(action.dc.allowCustom, true);
  assert.equal(action.dc.choiceLabel, "PF2EActionForge.LearnSpell.DCLabel");
  assert.equal(action.dc.choiceHint, "PF2EActionForge.LearnSpell.DCHint");
  assert.equal(action.dc.customLabel, "PF2EActionForge.LearnSpell.CustomDCLabel");
  assert.equal(action.dc.customHint, "PF2EActionForge.LearnSpell.CustomDCHint");
  assert.deepEqual(action.dc.choices.map((entry) => entry.value), [15, 18, 20, 23, 26, 28, 31, 34, 36, 41]);
});

test("DCResolver accepts a GM custom Learn a Spell DC after ActionRegistry normalization", async () => {
  const oldGame = globalThis.game;
  try {
    globalThis.game = { user: { isGM: true } };
    const registry = await registeredCatalog();
    const { DCResolver } = await import(`../scripts/core/dc-resolver.js?dev13-1-dc=${Date.now()}-${Math.random()}`);
    const state = new DCResolver().getState(
      registry.get("learn-a-spell"),
      { targets: [] },
      { manualDc: 25, statistic: "arcana", actor: null }
    );
    assert.equal(state.valid, true);
    assert.equal(state.source, "fixed-choice-custom");
    assert.equal(state.difficultyClass, 25);
    assert.equal(state.custom, true);
    assert.equal(state.allowsManualDc, true);
  } finally {
    globalThis.game = oldGame;
  }
});

test("PF2e statistic adapter keeps a registered public Earn Income DC hidden", async () => {
  const oldGame = globalThis.game;
  try {
    globalThis.game = {
      pf2e: { actions: new Map() },
      i18n: { localize: (value) => value }
    };
    let rollOptions = null;
    const actor = {
      getStatistic: (slug) => slug === "performance"
        ? {
            roll: async (options) => {
              rollOptions = options;
              const roll = { total: 24, degreeOfSuccess: 2 };
              options.callback?.(roll, "success", null);
              return roll;
            }
          }
        : null
    };
    const registry = await registeredCatalog();
    const { PF2eActionAdapter } = await import(`../scripts/core/pf2e-action-adapter.js?dev13-1-adapter=${Date.now()}-${Math.random()}`);
    const result = await new PF2eActionAdapter().execute({
      definition: registry.get("earn-income"),
      actor,
      difficultyClass: 22,
      statistic: "performance"
    });
    assert.equal(result.ok, true);
    assert.equal(rollOptions.dc.value, 22);
    assert.equal(rollOptions.dc.visible, false);
  } finally {
    globalThis.game = oldGame;
  }
});
