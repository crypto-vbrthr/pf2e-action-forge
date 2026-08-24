import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

const DEV10_IDS = [
  "balance",
  "squeeze",
  "shove",
  "reposition",
  "disarm",
  "force-open",
  "swim",
  "high-jump",
  "long-jump",
  "create-a-diversion",
  "feint"
];

test("dev.10 registers the complete agreed Combat & Movement action set", async () => {
  const { CORE_ACTIONS } = await import(`../scripts/data/core-action-catalog.js?dev10-catalog=${Date.now()}`);
  const byId = new Map(CORE_ACTIONS.map((action) => [action.id, action]));

  for (const id of DEV10_IDS) assert.ok(byId.has(id), `${id} should be registered`);
  assert.equal(CORE_ACTIONS.length, 65);

  assert.equal(byId.get("balance").execution.statistic, "acrobatics");
  assert.equal(byId.get("squeeze").execution.statistic, "acrobatics");
  for (const id of ["shove", "reposition", "disarm", "force-open", "swim", "high-jump", "long-jump"]) {
    assert.equal(byId.get(id).execution.statistic, "athletics", `${id} should use Athletics`);
  }
  for (const id of ["create-a-diversion", "feint"]) {
    assert.equal(byId.get(id).execution.statistic, "deception", `${id} should use Deception`);
  }
});

test("dev.10 DC and target models match the combat/movement workflows", async () => {
  const { CORE_ACTIONS } = await import(`../scripts/data/core-action-catalog.js?dev10-dc=${Date.now()}`);
  const byId = new Map(CORE_ACTIONS.map((action) => [action.id, action]));

  for (const id of ["balance", "squeeze", "force-open", "swim"]) {
    assert.equal(byId.get(id).dc.strategy, "manual", `${id} should use an environmental/manual DC`);
    assert.equal(byId.get(id).target.mode, "none");
  }

  assert.deepEqual(
    ["shove", "reposition"].map((id) => [id, byId.get(id).dc.strategy, byId.get(id).dc.defense, byId.get(id).target.mode]),
    [
      ["shove", "target-defense", "fortitude", "single"],
      ["reposition", "target-defense", "fortitude", "single"]
    ]
  );
  assert.equal(byId.get("disarm").dc.defense, "reflex");
  assert.equal(byId.get("feint").dc.defense, "perception");
  assert.equal(byId.get("create-a-diversion").dc.defense, "perception");
  assert.equal(byId.get("create-a-diversion").target.mode, "multiple");
  assert.equal(byId.get("create-a-diversion").execution.sharedRoll, true);
  assert.notEqual(byId.get("create-a-diversion").execution.singleTargetOnly, true);

  assert.equal(byId.get("high-jump").dc.strategy, "fixed");
  assert.equal(byId.get("high-jump").dc.value, 30);
  assert.equal(byId.get("long-jump").dc.strategy, "fixed");
  assert.equal(byId.get("long-jump").dc.value, 15);
});

test("trained-only dev.10 actions are rank-gated", async () => {
  const { CORE_ACTIONS } = await import(`../scripts/data/core-action-catalog.js?dev10-ranks=${Date.now()}`);
  const byId = new Map(CORE_ACTIONS.map((action) => [action.id, action]));
  assert.equal(byId.get("squeeze").execution.minRank, 1);
  assert.equal(byId.get("disarm").execution.minRank, 1);
  assert.equal(byId.get("feint").execution.minRank, 1);
  assert.equal(byId.get("shove").execution.minRank ?? 0, 0);
  assert.equal(byId.get("reposition").execution.minRank ?? 0, 0);
});

test("PF2e Action Adapter resolves every dev.10 system-action slug", async () => {
  const oldGame = globalThis.game;
  try {
    const actions = new Map(DEV10_IDS.map((slug) => [slug, { slug, use: async () => [] }]));
    globalThis.game = { pf2e: { actions } };

    const { CORE_ACTIONS } = await import(`../scripts/data/core-action-catalog.js?dev10-slugs=${Date.now()}`);
    const { PF2eActionAdapter } = await import(`../scripts/core/pf2e-action-adapter.js?dev10-adapter=${Date.now()}`);
    const adapter = new PF2eActionAdapter();
    const byId = new Map(CORE_ACTIONS.map((action) => [action.id, action]));

    for (const id of DEV10_IDS) {
      const definition = byId.get(id);
      assert.equal(definition.systemAction.slug, id);
      assert.equal(adapter.getSystemAction(definition)?.slug, id);
      assert.equal(adapter.isAvailable(definition), true);
    }
  } finally {
    globalThis.game = oldGame;
  }
});

test("dev.10 opens substantially wider and keeps multi-card skill grids", async () => {
  const app = await readFile(new URL("scripts/ui/action-forge-app.js", root), "utf8");
  const css = await readFile(new URL("styles/action-forge.css", root), "utf8");

  assert.match(app, /position:\s*\{[\s\S]*width:\s*1120,[\s\S]*height:\s*820/);
  assert.match(css, /\.pf2e-action-forge\s*\{[\s\S]*min-width:\s*640px;/);
  assert.match(css, /\.af-action-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(235px,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*min-width:\s*440px/);
});
