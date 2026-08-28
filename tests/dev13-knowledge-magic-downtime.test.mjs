import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const DEV13_IDS = [
  "earn-income",
  "identify-magic",
  "decipher-writing",
  "learn-a-spell",
  "prepare-from-spellbook",
  "maneuver-in-flight",
  "create-forgery",
  "command-an-animal"
];

async function catalog() {
  const { CORE_ACTIONS } = await import(`../scripts/data/core-action-catalog.js?dev13=${Date.now()}-${Math.random()}`);
  return { CORE_ACTIONS, byId: new Map(CORE_ACTIONS.map((action) => [action.id, action])) };
}

test("dev.13 expands the Player Core skill-action catalog from 43 to 51 actions", async () => {
  const { CORE_ACTIONS, byId } = await catalog();
  assert.equal(CORE_ACTIONS.length, 65);
  for (const id of DEV13_IDS) assert.ok(byId.has(id), `${id} should be registered`);
});

test("Identify Magic and Decipher Writing offer the correct trained tradition/knowledge skills and secret visibility", async () => {
  const { byId } = await catalog();
  const identify = byId.get("identify-magic");
  assert.deepEqual(identify.execution.statistics, ["arcana", "nature", "occultism", "religion"]);
  assert.equal(identify.execution.minRank, 1);
  assert.equal(identify.dc.strategy, "gm-defined");
  assert.equal(identify.dc.allowUnknown, true);
  assert.equal(identify.visibility.roll, "blind");
  assert.equal(identify.visibility.outcome, "gm");

  const decipher = byId.get("decipher-writing");
  assert.deepEqual(decipher.execution.statistics, ["arcana", "society", "occultism", "religion"]);
  assert.equal(decipher.execution.minRank, 1);
  assert.equal(decipher.visibility.roll, "blind");
  assert.equal(decipher.visibility.outcome, "gm");
});

test("Learn a Spell exposes all ten Player Core rank DCs, costs through localization, and a custom rarity DC", async () => {
  const { byId } = await catalog();
  const action = byId.get("learn-a-spell");
  assert.equal(action.dc.strategy, "fixed-choice");
  assert.equal(action.dc.allowCustom, true);
  assert.deepEqual(action.dc.choices.map((entry) => entry.value), [15, 18, 20, 23, 26, 28, 31, 34, 36, 41]);
  assert.deepEqual(action.execution.statistics, ["arcana", "nature", "occultism", "religion"]);
  assert.equal(action.execution.minRank, 1);

  const de = JSON.parse(await readFile(new URL("lang/de.json", root), "utf8"));
  const en = JSON.parse(await readFile(new URL("lang/en.json", root), "utf8"));
  assert.match(de["PF2EActionForge.LearnSpell.Rank1"], /2 GM/);
  assert.match(de["PF2EActionForge.LearnSpell.Rank10"], /7\.000 GM/);
  assert.match(en["PF2EActionForge.LearnSpell.Rank10"], /7,000 gp/);
});

test("fixed-choice DCs keep rule choices player-selectable and reserve custom values for the GM", async () => {
  const oldGame = globalThis.game;
  try {
    const { DCResolver } = await import(`../scripts/core/dc-resolver.js?dev13-custom=${Date.now()}`);
    const { byId } = await catalog();
    const resolver = new DCResolver();
    const action = byId.get("learn-a-spell");

    const standard = resolver.getState(action, { targets: [] }, { manualDc: 23, statistic: "arcana", actor: null, user: { isGM: false } });
    assert.equal(standard.valid, true);
    assert.equal(standard.source, "fixed-choice");
    assert.equal(standard.difficultyClass, 23);
    assert.equal(standard.custom, false);

    const injected = resolver.getState(action, { targets: [] }, { manualDc: 25, statistic: "arcana", actor: null, user: { isGM: false } });
    assert.equal(injected.source, "fixed-choice");
    assert.equal(injected.difficultyClass, 15);
    assert.equal(injected.custom, false);
    assert.equal(injected.allowsManualDc, false);

    const custom = resolver.getState(action, { targets: [] }, { manualDc: 25, statistic: "arcana", actor: null, user: { isGM: true } });
    assert.equal(custom.valid, true);
    assert.equal(custom.source, "fixed-choice-custom");
    assert.equal(custom.difficultyClass, 25);
    assert.equal(custom.custom, true);
    assert.equal(custom.allowsManualDc, true);
  } finally {
    globalThis.game = oldGame;
  }
});

test("Earn Income supports Performance, Crafting, and Lore while keeping the GM-defined DC hidden", async () => {
  const { byId } = await catalog();
  const action = byId.get("earn-income");
  assert.equal(action.execution.mode, "statistic");
  assert.deepEqual(action.execution.statistics, ["performance", "crafting"]);
  assert.equal(action.execution.includeLore, true);
  assert.equal(action.execution.minRank, 1);
  assert.equal(action.dc.strategy, "gm-defined");
  assert.equal(action.dc.hidden, true);
  assert.equal(action.visibility.roll, "public");
});

test("a public Earn Income statistic roll does not expose its hidden GM DC", async () => {
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
    const { byId } = await catalog();
    const { PF2eActionAdapter } = await import(`../scripts/core/pf2e-action-adapter.js?dev13-income=${Date.now()}`);
    const result = await new PF2eActionAdapter().execute({
      definition: byId.get("earn-income"),
      actor,
      difficultyClass: 22,
      statistic: "performance"
    });
    assert.equal(result.ok, true);
    assert.equal(rollOptions.dc.value, 22);
    assert.equal(rollOptions.dc.visible, false);
    assert.deepEqual(rollOptions.traits ?? [], []);
  } finally {
    globalThis.game = oldGame;
  }
});

test("Prepare from Another Spellbook, Maneuver in Flight, Create Forgery, and Command an Animal retain their distinct rule models", async () => {
  const { byId } = await catalog();
  const spellbook = byId.get("prepare-from-spellbook");
  assert.equal(spellbook.category, "arcana");
  assert.equal(spellbook.execution.statistic, "arcana");
  assert.equal(spellbook.execution.minRank, 1);
  assert.equal(spellbook.dc.strategy, "gm-defined");
  assert.equal(spellbook.dc.allowUnknown, true);

  const flight = byId.get("maneuver-in-flight");
  assert.equal(flight.execution.statistic, "acrobatics");
  assert.equal(flight.execution.minRank, 1);
  assert.equal(flight.dc.strategy, "manual");

  const forgery = byId.get("create-forgery");
  assert.equal(forgery.category, "society");
  assert.equal(forgery.execution.statistic, "society");
  assert.equal(forgery.execution.minRank, 1);
  assert.equal(forgery.dc.strategy, "fixed");
  assert.equal(forgery.dc.value, 20);
  assert.equal(forgery.visibility.roll, "blind");
  assert.equal(forgery.visibility.outcome, "gm");

  const animal = byId.get("command-an-animal");
  assert.equal(animal.category, "nature");
  assert.equal(animal.execution.statistic, "nature");
  assert.equal(animal.target.mode, "single");
  assert.equal(animal.target.required, true);
  assert.equal(animal.dc.strategy, "target-defense");
  assert.equal(animal.dc.defense, "will");
});

test("dev.13 localization is complete in German and English and includes the new skill categories", async () => {
  const de = JSON.parse(await readFile(new URL("lang/de.json", root), "utf8"));
  const en = JSON.parse(await readFile(new URL("lang/en.json", root), "utf8"));
  assert.deepEqual(Object.keys(de).sort(), Object.keys(en).sort());
  for (const key of [
    "PF2EActionForge.Categories.Arcana",
    "PF2EActionForge.Categories.Society",
    "PF2EActionForge.Categories.Nature",
    "PF2EActionForge.Actions.EarnIncome.Name",
    "PF2EActionForge.Actions.IdentifyMagic.Name",
    "PF2EActionForge.Actions.DecipherWriting.Name",
    "PF2EActionForge.Actions.LearnASpell.Name",
    "PF2EActionForge.Actions.PrepareFromSpellbook.Name",
    "PF2EActionForge.Actions.ManeuverInFlight.Name",
    "PF2EActionForge.Actions.CreateForgery.Name",
    "PF2EActionForge.Actions.CommandAnAnimal.Name"
  ]) {
    assert.ok(de[key], `${key} should exist in German`);
    assert.ok(en[key], `${key} should exist in English`);
  }
});

test("rc.3 manifest, fallback versions, and release URL are synchronized", async () => {
  const manifest = JSON.parse(await readFile(new URL("module.json", root), "utf8"));
  const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  const app = await readFile(new URL("scripts/ui/action-forge-app.js", root), "utf8");
  const bootstrap = await readFile(new URL("scripts/action-forge.js", root), "utf8");
  assert.equal(manifest.version, "0.1.0-rc.3.1");
  assert.equal(pkg.version, "0.1.0-rc.3.1");
  assert.match(manifest.download, /v0\.1\.0-rc\.3\.1\/pf2e-action-forge\.zip$/);
  assert.match(app, /0\.1\.0-rc\.3/);
  assert.match(bootstrap, /0\.1\.0-rc\.3/);
});
