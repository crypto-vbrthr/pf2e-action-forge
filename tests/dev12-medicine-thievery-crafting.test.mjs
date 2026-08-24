import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

const DEV12_IDS = [
  "palm-an-object",
  "steal",
  "disable-a-device",
  "pick-a-lock",
  "repair",
  "identify-alchemy",
  "craft",
  "administer-first-aid-stabilize",
  "administer-first-aid-stop-bleeding",
  "treat-disease",
  "treat-poison"
];

test("dev.12 registers Medicine, Thievery, and Crafting workflows", async () => {
  const { CORE_ACTIONS } = await import(`../scripts/data/core-action-catalog.js?dev12-catalog=${Date.now()}`);
  const byId = new Map(CORE_ACTIONS.map((action) => [action.id, action]));

  assert.equal(CORE_ACTIONS.length, 65);
  for (const id of DEV12_IDS) assert.ok(byId.has(id), `${id} should be registered`);

  for (const id of ["palm-an-object", "steal", "disable-a-device", "pick-a-lock"]) {
    assert.equal(byId.get(id).execution.statistic, "thievery", `${id} should use Thievery`);
  }
  for (const id of ["repair", "identify-alchemy", "craft"]) {
    assert.equal(byId.get(id).execution.statistic, "crafting", `${id} should use Crafting`);
  }
  for (const id of ["administer-first-aid-stabilize", "administer-first-aid-stop-bleeding", "treat-disease", "treat-poison"]) {
    assert.equal(byId.get(id).execution.statistic, "medicine", `${id} should use Medicine`);
  }

  assert.equal(byId.get("disable-a-device").execution.minRank, 1);
  assert.equal(byId.get("pick-a-lock").execution.minRank, 1);
  assert.equal(byId.get("identify-alchemy").execution.minRank, 1);
  assert.equal(byId.get("craft").execution.minRank, 1);
  assert.equal(byId.get("treat-disease").execution.minRank, 1);
  assert.equal(byId.get("treat-poison").execution.minRank, 1);
  assert.equal(
    byId.get("administer-first-aid-stabilize").application.outcomes.criticalFailure[0].delta,
    1,
    "First Aid critical failure should retain the Dying increment metadata"
  );
});

test("dev.12 DC and visibility models preserve GM-set and secret workflows", async () => {
  const { CORE_ACTIONS } = await import(`../scripts/data/core-action-catalog.js?dev12-dc=${Date.now()}`);
  const byId = new Map(CORE_ACTIONS.map((action) => [action.id, action]));

  assert.equal(byId.get("palm-an-object").dc.strategy, "target-defense");
  assert.equal(byId.get("palm-an-object").dc.defense, "perception");
  assert.equal(byId.get("palm-an-object").target.mode, "multiple");
  assert.equal(byId.get("palm-an-object").execution.sharedRoll, true);
  assert.notEqual(byId.get("palm-an-object").execution.singleTargetOnly, true);
  assert.equal(byId.get("steal").dc.defense, "perception");

  for (const id of ["disable-a-device", "pick-a-lock", "repair", "craft", "treat-disease", "treat-poison", "administer-first-aid-stop-bleeding"]) {
    assert.equal(byId.get(id).dc.strategy, "gm-defined", `${id} should use a GM-set DC`);
    assert.equal(byId.get(id).dc.allowUnknown, true, `${id} should support GM DC handoff`);
  }

  assert.equal(byId.get("identify-alchemy").visibility.roll, "blind");
  assert.equal(byId.get("identify-alchemy").visibility.outcome, "gm");
  assert.equal(byId.get("administer-first-aid-stabilize").dc.strategy, "target-dying");
});

test("First Aid stabilization derives DC 15 + Dying and keeps opaque picker targets broker-safe", async () => {
  const oldGame = globalThis.game;
  try {
    globalThis.game = { user: { isGM: false } };
    const { DCResolver } = await import(`../scripts/core/dc-resolver.js?dev12-dying=${Date.now()}`);
    const resolver = new DCResolver();
    const action = { dc: { strategy: "target-dying", allowUnknown: true } };
    const dying = { value: 2 };
    const targetActor = {
      conditions: { bySlug: (slug) => slug === "dying" ? [dying] : [] }
    };

    const local = resolver.getState(action, {
      targets: [{ actor: targetActor, token: null, name: "Patient" }]
    }, { user: { isGM: false } });
    assert.equal(local.valid, true);
    assert.equal(local.source, "target-dying");
    assert.equal(local.difficultyClass, 17);
    assert.equal(local.dyingValue, 2);

    const conscious = resolver.getState(action, {
      targets: [{ actor: { conditions: { bySlug: () => [] } }, token: null, name: "Standing Patient" }]
    }, { user: { isGM: false } });
    assert.equal(conscious.valid, false);
    assert.equal(conscious.source, "missing-dying");
    assert.equal(conscious.requiresGmHandoff, undefined);

    const remote = resolver.getState(action, {
      targets: [{ actor: null, token: null, actorUuid: "Actor.patient", remote: true, name: "Patient" }]
    }, { user: { isGM: false } });
    assert.equal(remote.valid, true);
    assert.equal(remote.requiresGmHandoff, true);
    assert.equal(remote.difficultyClass, undefined);
  } finally {
    globalThis.game = oldGame;
  }
});

test("First Aid critical failure can increment an existing valued PF2e condition", async () => {
  const { ApplicationEngine } = await import(`../scripts/core/application-engine.js?dev12-increase=${Date.now()}`);
  const engine = new ApplicationEngine();
  let updated = null;
  const condition = {
    id: "dying-id",
    value: 2,
    update: async (changes) => { updated = changes; condition.value = changes["system.value.value"]; }
  };
  const targetActor = {
    conditions: { bySlug: (slug) => slug === "dying" ? [condition] : [] }
  };

  const result = await engine.apply({
    effect: { id: "increase-dying", type: "condition-increase", condition: "dying", delta: 1 },
    targetActor
  });

  assert.equal(result.ok, true);
  assert.equal(result.previousValue, 2);
  assert.equal(result.value, 3);
  assert.deepEqual(updated, { "system.value.value": 3 });
});

test("dev.12 statistic fallbacks keep public treatment rolls public and identification rolls secret", async () => {
  const oldGame = globalThis.game;
  try {
    globalThis.game = {
      pf2e: { actions: new Map() },
      i18n: { localize: (value) => value }
    };
    const calls = [];
    const actor = {
      getStatistic: (slug) => slug === "medicine" || slug === "crafting"
        ? {
            roll: async (options) => {
              calls.push({ slug, options });
              const roll = { total: 22, degreeOfSuccess: 2 };
              options.callback?.(roll, "success", null);
              return roll;
            }
          }
        : null
    };

    const { CORE_ACTIONS } = await import(`../scripts/data/core-action-catalog.js?dev12-fallback=${Date.now()}`);
    const { PF2eActionAdapter } = await import(`../scripts/core/pf2e-action-adapter.js?dev12-fallback=${Date.now()}`);
    const adapter = new PF2eActionAdapter();
    const byId = new Map(CORE_ACTIONS.map((action) => [action.id, action]));

    const poison = await adapter.execute({ definition: byId.get("treat-poison"), actor, difficultyClass: 24 });
    assert.equal(poison.ok, true);
    assert.equal(calls[0].options.dc.value, 24);
    assert.equal(calls[0].options.dc.visible, true);

    const identify = await adapter.execute({ definition: byId.get("identify-alchemy"), actor, difficultyClass: 21 });
    assert.equal(identify.ok, true);
    assert.equal(calls[1].options.dc.value, 21);
    assert.equal(calls[1].options.dc.visible, false);
    assert.deepEqual(calls[1].options.traits, ["secret"]);
  } finally {
    globalThis.game = oldGame;
  }
});

test("dev.12 keeps the wide catalog UI and makes the footer version dynamic", async () => {
  const template = await readFile(new URL("templates/action-forge.hbs", root), "utf8");
  const app = await readFile(new URL("scripts/ui/action-forge-app.js", root), "utf8");
  assert.match(template, /\{\{moduleVersion\}\} · \{\{localize "PF2EActionForge\.Footer\.Catalog"\}\}/);
  assert.match(app, /width:\s*1120/);
  assert.match(app, /0\.1\.0-dev\.17/);
});
