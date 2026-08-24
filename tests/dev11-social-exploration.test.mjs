import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

const DEV11_IDS = [
  "perform",
  "make-an-impression",
  "request",
  "gather-information",
  "impersonate",
  "coerce",
  "conceal-an-object",
  "hide",
  "sneak",
  "subsist",
  "sense-direction",
  "track",
  "cover-tracks"
];

test("dev.11 registers the agreed social and exploration action set", async () => {
  const { CORE_ACTIONS } = await import(`../scripts/data/core-action-catalog.js?dev11-catalog=${Date.now()}`);
  const byId = new Map(CORE_ACTIONS.map((action) => [action.id, action]));

  assert.equal(CORE_ACTIONS.length, 51);
  for (const id of DEV11_IDS) assert.ok(byId.has(id), `${id} should be registered`);

  assert.equal(byId.get("perform").execution.statistic, "performance");
  for (const id of ["make-an-impression", "request", "gather-information"]) {
    assert.equal(byId.get(id).execution.statistic, "diplomacy", `${id} should use Diplomacy`);
  }
  assert.equal(byId.get("impersonate").execution.statistic, "deception");
  assert.equal(byId.get("coerce").execution.statistic, "intimidation");
  for (const id of ["conceal-an-object", "hide", "sneak"]) {
    assert.equal(byId.get(id).execution.statistic, "stealth", `${id} should use Stealth`);
  }
  for (const id of ["sense-direction", "track"]) {
    assert.equal(byId.get(id).execution.statistic, "survival", `${id} should use Survival`);
  }
});

test("dev.11 models social DCs and secret checks without exposing hidden outcomes", async () => {
  const { CORE_ACTIONS } = await import(`../scripts/data/core-action-catalog.js?dev11-dc=${Date.now()}`);
  const byId = new Map(CORE_ACTIONS.map((action) => [action.id, action]));

  assert.deepEqual(
    ["make-an-impression", "coerce"].map((id) => [id, byId.get(id).dc.strategy, byId.get(id).dc.defense]),
    [
      ["make-an-impression", "target-defense", "will"],
      ["coerce", "target-defense", "will"]
    ]
  );
  assert.equal(byId.get("request").dc.strategy, "manual");
  assert.equal(byId.get("perform").dc.strategy, "manual");

  for (const id of ["gather-information", "sense-direction"]) {
    const action = byId.get(id);
    assert.equal(action.dc.strategy, "gm-defined", `${id} should use GM adjudication`);
    assert.equal(action.dc.allowUnknown, true, `${id} should support the GM DC handoff`);
    assert.equal(action.visibility.roll, "blind", `${id} should roll blind`);
    assert.equal(action.visibility.outcome, "gm", `${id} should keep the outcome GM-only`);
  }

  for (const id of ["impersonate", "conceal-an-object", "hide", "sneak"]) {
    const action = byId.get(id);
    assert.equal(action.dc.strategy, "target-defense", `${id} should use an observer's defense when one is selected`);
    assert.equal(action.dc.defense, "perception", `${id} should test against Perception DC`);
    assert.equal(action.dc.allowUnknown, true, `${id} should fall back to the GM handoff when observers are unknown`);
    assert.equal(action.visibility.roll, "blind", `${id} should roll blind`);
    assert.equal(action.visibility.outcome, "gm", `${id} should keep the outcome GM-only`);
  }
});

test("Subsist supports Society or Survival and Track remains trained-only", async () => {
  const { CORE_ACTIONS } = await import(`../scripts/data/core-action-catalog.js?dev11-ranks=${Date.now()}`);
  const byId = new Map(CORE_ACTIONS.map((action) => [action.id, action]));
  const subsist = byId.get("subsist");

  assert.equal(subsist.execution.requiresStatistic, true);
  assert.deepEqual([...subsist.execution.statistics], ["society", "survival"]);
  assert.equal(subsist.dc.strategy, "manual");
  assert.equal(byId.get("track").execution.minRank, 1);
  assert.equal(byId.get("cover-tracks").execution.minRank, 1);
});

test("secret observer checks use Perception when readable and GM handoff when the observer is unknown", async () => {
  const { DCResolver } = await import(`../scripts/core/dc-resolver.js?dev11-observer-dc=${Date.now()}`);
  const resolver = new DCResolver();
  const action = { dc: { strategy: "target-defense", defense: "perception", allowUnknown: true } };
  const observer = {
    uuid: "Actor.observer",
    getStatistic: (slug) => slug === "perception" ? { dc: { value: 28 } } : null
  };

  const readable = resolver.getState(action, {
    targets: [{ source: "sidebar", actor: observer, token: null, name: "Observer" }]
  }, { user: { isGM: false } });
  assert.equal(readable.valid, true);
  assert.equal(readable.source, "target");
  assert.equal(readable.difficultyClass, 28);
  assert.equal(readable.requiresGmHandoff ?? false, false);

  const unknownForPlayer = resolver.getState(action, { targets: [] }, { user: { isGM: false } });
  assert.equal(unknownForPlayer.valid, true);
  assert.equal(unknownForPlayer.source, "gm");
  assert.equal(unknownForPlayer.requiresGmHandoff, true);
  assert.equal(unknownForPlayer.allowsManualDc, false);

  const gmMissing = resolver.getState(action, { targets: [] }, { user: { isGM: true } });
  assert.equal(gmMissing.valid, false);
  assert.equal(gmMissing.needsManualDc, true);
  assert.equal(gmMissing.allowsManualDc, true);

  const gmReady = resolver.getState(action, { targets: [] }, { manualDc: 31, user: { isGM: true } });
  assert.equal(gmReady.valid, true);
  assert.equal(gmReady.difficultyClass, 31);
});

test("system-or-statistic actions fall back to prepared PF2e statistics", async () => {
  const oldGame = globalThis.game;
  let rollOptions = null;
  try {
    globalThis.game = {
      pf2e: { actions: new Map() },
      i18n: { localize: (value) => value }
    };
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

    const { CORE_ACTIONS } = await import(`../scripts/data/core-action-catalog.js?dev11-fallback=${Date.now()}`);
    const { PF2eActionAdapter } = await import(`../scripts/core/pf2e-action-adapter.js?dev11-fallback=${Date.now()}`);
    const definition = CORE_ACTIONS.find((action) => action.id === "perform");
    const adapter = new PF2eActionAdapter();

    assert.equal(adapter.isAvailable(definition), true);
    const result = await adapter.execute({ definition, actor, difficultyClass: 20 });
    assert.equal(result.ok, true);
    assert.equal(result.results[0].outcome, "success");
    assert.equal(rollOptions.dc.value, 20);
    assert.equal(rollOptions.dc.visible, true);
  } finally {
    globalThis.game = oldGame;
  }
});

test("secret statistic fallback keeps GM DCs hidden and adds the secret trait", async () => {
  const oldGame = globalThis.game;
  let rollOptions = null;
  try {
    globalThis.game = {
      pf2e: { actions: new Map() },
      i18n: { localize: (value) => value }
    };
    const actor = {
      getStatistic: (slug) => slug === "diplomacy"
        ? {
            roll: async (options) => {
              rollOptions = options;
              const roll = { total: 19, degreeOfSuccess: 1 };
              options.callback?.(roll, "failure", null);
              return roll;
            }
          }
        : null
    };

    const { CORE_ACTIONS } = await import(`../scripts/data/core-action-catalog.js?dev11-secret=${Date.now()}`);
    const { PF2eActionAdapter } = await import(`../scripts/core/pf2e-action-adapter.js?dev11-secret=${Date.now()}`);
    const definition = CORE_ACTIONS.find((action) => action.id === "gather-information");
    const adapter = new PF2eActionAdapter();
    const result = await adapter.execute({ definition, actor, difficultyClass: 21 });

    assert.equal(result.ok, true);
    assert.equal(rollOptions.dc.value, 21);
    assert.equal(rollOptions.dc.visible, false);
    assert.deepEqual(rollOptions.traits, ["secret"]);
  } finally {
    globalThis.game = oldGame;
  }
});

test("Cover Tracks uses the no-roll activity path and the UI labels activity execution", async () => {
  const oldGame = globalThis.game;
  try {
    globalThis.game = { pf2e: { actions: new Map() } };
    const { CORE_ACTIONS } = await import(`../scripts/data/core-action-catalog.js?dev11-activity=${Date.now()}`);
    const { PF2eActionAdapter } = await import(`../scripts/core/pf2e-action-adapter.js?dev11-activity=${Date.now()}`);
    const definition = CORE_ACTIONS.find((action) => action.id === "cover-tracks");
    const adapter = new PF2eActionAdapter();

    assert.equal(definition.execution.mode, "activity");
    assert.equal(definition.dc.strategy, "none");
    assert.equal(adapter.isAvailable(definition), true);
    assert.deepEqual(await adapter.execute({ definition, actor: {} }), {
      ok: true,
      action: null,
      activity: true,
      results: []
    });

    const app = await readFile(new URL("scripts/ui/action-forge-app.js", root), "utf8");
    const template = await readFile(new URL("templates/action-forge.hbs", root), "utf8");
    assert.match(app, /PF2EActionForge\.Roll\.StartActivity/);
    assert.match(template, /executionContext\.activity/);
  } finally {
    globalThis.game = oldGame;
  }
});
