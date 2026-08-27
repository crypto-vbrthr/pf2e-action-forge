import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));

async function catalog() {
  const { CORE_ACTIONS } = await import(`../scripts/data/core-action-catalog.js?dev15=${Date.now()}-${Math.random()}`);
  return CORE_ACTIONS;
}

const SKILL_CARD_IDS = new Set([
  "recall-knowledge", "earn-income", "identify-magic", "decipher-writing", "learn-a-spell",
  "balance", "tumble-through", "squeeze", "prepare-from-spellbook", "maneuver-in-flight",
  "grapple", "trip", "shove", "reposition", "disarm", "force-open", "climb", "swim", "high-jump", "long-jump",
  "perform", "palm-an-object", "steal", "disable-a-device", "pick-a-lock",
  "make-an-impression", "request", "gather-information",
  "create-a-diversion", "lie", "impersonate", "feint", "coerce", "demoralize",
  "conceal-an-object", "hide", "sneak", "subsist", "sense-direction", "track", "cover-tracks",
  "create-forgery", "command-an-animal", "repair", "identify-alchemy", "craft",
  "administer-first-aid-stabilize", "administer-first-aid-stop-bleeding", "treat-disease", "treat-poison", "treat-wounds"
]);

const TRAINED_ONLY = new Set([
  "earn-income", "identify-magic", "decipher-writing", "learn-a-spell", "squeeze",
  "prepare-from-spellbook", "maneuver-in-flight", "disarm", "disable-a-device", "pick-a-lock",
  "feint", "track", "cover-tracks", "create-forgery", "identify-alchemy", "craft",
  "treat-disease", "treat-poison", "treat-wounds"
]);

const EXPLORATION_IDS = new Set([
  "exploration-search", "follow-the-expert", "sustain-an-effect", "hustle", "detect-magic-exploration",
  "scout", "avoid-notice-exploration", "investigate-exploration", "defend-exploration", "repeat-a-spell"
]);

const CORE_UTILITY_IDS = new Set(["escape", "sense-motive", "seek", "aid"]);

function referencedLocalizationKeys(action) {
  const keys = [
    action.label, action.description, action.categoryLabel,
    action.execution?.statisticLabel, action.execution?.statisticHint,
    action.dc?.choiceLabel, action.dc?.choiceHint, action.dc?.customLabel, action.dc?.customHint,
    ...Object.values(action.application?.outcomeNotes ?? {}),
    ...Object.values(action.application?.outcomes ?? {}).flat().map((effect) => effect?.label)
  ];
  for (const choice of action.dc?.choices ?? []) keys.push(choice?.label);
  return keys.filter(Boolean);
}

test("rc.3 release metadata is synchronized", async () => {
  const manifest = await readJson("module.json");
  const pkg = await readJson("package.json");
  assert.equal(manifest.version, "0.1.0-rc.3");
  assert.equal(pkg.version, "0.1.0-rc.3");
  assert.equal(manifest.download, "https://github.com/crypto-vbrthr/pf2e-action-forge/releases/download/v0.1.0-rc.3/pf2e-action-forge.zip");
});

test("full catalog has 65 unique cards with the reviewed 51 + 4 + 10 split", async () => {
  const actions = await catalog();
  assert.equal(actions.length, 65);
  assert.equal(new Set(actions.map((action) => action.id)).size, 65);
  assert.equal(actions.filter((action) => SKILL_CARD_IDS.has(action.id)).length, 51);
  assert.equal(actions.filter((action) => CORE_UTILITY_IDS.has(action.id)).length, 4);
  assert.equal(actions.filter((action) => EXPLORATION_IDS.has(action.id)).length, 10);
  for (const action of actions) {
    assert.ok(SKILL_CARD_IDS.has(action.id) || CORE_UTILITY_IDS.has(action.id) || EXPLORATION_IDS.has(action.id), action.id);
  }
});

test("trained-only proficiency gates match the reviewed Player Core skill surface", async () => {
  const actions = await catalog();
  const gated = new Set(actions.filter((action) => (action.execution?.minRank ?? 0) >= 1).map((action) => action.id));
  assert.deepEqual([...gated].sort(), [...TRAINED_ONLY].sort());
});

test("ActionRegistry preserves every catalog action and deep-freezes DC choices", async () => {
  const actions = await catalog();
  const { ActionRegistry } = await import(`../scripts/core/action-registry.js?dev15-registry=${Date.now()}`);
  const registry = new ActionRegistry();
  registry.registerMany(actions);
  assert.equal(registry.list().length, actions.length);

  for (const raw of actions) {
    const normalized = registry.get(raw.id);
    assert.ok(normalized, raw.id);
    assert.equal(normalized.id, raw.id);
    assert.equal(normalized.target.mode, raw.target.mode, `${raw.id}: target mode`);
    assert.equal(normalized.dc.strategy, raw.dc.strategy, `${raw.id}: DC strategy`);
    assert.equal(normalized.systemAction.slug, raw.systemAction?.slug ?? raw.id, `${raw.id}: system action`);
    assert.equal(normalized.execution.enabled, raw.execution.enabled, `${raw.id}: enabled`);
    assert.ok(Object.isFrozen(normalized));
    assert.ok(Object.isFrozen(normalized.dc));
    assert.ok(Object.isFrozen(normalized.execution));
    assert.ok(Object.isFrozen(normalized.visibility));
    assert.ok(Object.isFrozen(normalized.application));
    assert.ok(Object.isFrozen(normalized.dc.choices));
    for (const choice of normalized.dc.choices) {
      if (choice && typeof choice === "object") assert.ok(Object.isFrozen(choice), `${raw.id}: DC choice must be frozen`);
    }
  }
});

test("all catalog localization references exist in both German and English", async () => {
  const actions = await catalog();
  const de = await readJson("lang/de.json");
  const en = await readJson("lang/en.json");
  for (const action of actions) {
    for (const key of referencedLocalizationKeys(action)) {
      assert.ok(Object.hasOwn(de, key), `${action.id}: missing DE key ${key}`);
      assert.ok(Object.hasOwn(en, key), `${action.id}: missing EN key ${key}`);
    }
  }
});

test("secret checks keep blind rolls and non-public outcomes", async () => {
  const actions = await catalog();
  const byId = new Map(actions.map((action) => [action.id, action]));
  const secret = [
    "sense-motive", "seek", "recall-knowledge", "identify-magic", "decipher-writing",
    "gather-information", "lie", "impersonate", "conceal-an-object", "hide", "sneak",
    "sense-direction", "create-forgery", "identify-alchemy"
  ];
  for (const id of secret) {
    const action = byId.get(id);
    assert.equal(action.visibility.roll, "blind", `${id}: roll visibility`);
    assert.ok(["gm", "none"].includes(action.visibility.outcome), `${id}: outcome visibility`);
  }
});

test("all persistent exploration activities are no-roll workflows and only one special entry requires a target", async () => {
  const actions = await catalog();
  const exploration = actions.filter((action) => EXPLORATION_IDS.has(action.id));
  assert.equal(exploration.length, 10);
  for (const action of exploration) {
    assert.equal(action.execution.mode, "exploration-activity", action.id);
    assert.equal(action.dc.strategy, "none", action.id);
    assert.equal(action.visibility.roll, "none", action.id);
  }
  assert.equal(exploration.filter((action) => action.target.mode !== "none").length, 1);
  assert.equal(exploration.find((action) => action.target.mode !== "none")?.id, "follow-the-expert");
});

test("free-form situational DC surfaces remain GM-authoritative after full-catalog normalization", async () => {
  const actions = await catalog();
  const { DCResolver } = await import(`../scripts/core/dc-resolver.js?dev15-dc=${Date.now()}`);
  const resolver = new DCResolver();
  const manualActions = actions.filter((action) => action.dc.strategy === "manual" || action.dc.strategy === "gm-defined");
  assert.ok(manualActions.length > 0);
  for (const action of manualActions) {
    const state = resolver.getState(action, { targets: [] }, { manualDc: 37, user: { isGM: false }, actor: null, statistic: null });
    assert.notEqual(state.difficultyClass, 37, `${action.id}: player-supplied free-form DC leaked through`);
    assert.equal(state.allowsManualDc, false, `${action.id}: player may not edit free-form DC`);
    if (action.dc.strategy === "manual" || !action.dc.systemTargetFallback) {
      assert.equal(state.requiresGmHandoff, true, `${action.id}: should request GM DC`);
    }
  }
});

test("privileged application catalog contains only the reviewed allow-listed effect types", async () => {
  const actions = await catalog();
  const allowed = new Set(["condition-add", "condition-increase", "condition-remove", "heal", "damage", "immunity"]);
  const effects = actions.flatMap((action) => Object.values(action.application?.outcomes ?? {}).flat());
  assert.ok(effects.length > 0);
  for (const effect of effects) {
    assert.ok(effect.id, "application effect must have an id");
    assert.ok(allowed.has(effect.type), `unexpected application type ${effect.type}`);
    assert.ok(["source", "target"].includes(effect.target ?? "target"));
  }
});

test("shared-roll actions now use the dev.16 multi-target contract", async () => {
  const actions = await catalog();
  const byId = new Map(actions.map((action) => [action.id, action]));
  for (const id of ["palm-an-object", "steal", "create-a-diversion", "lie", "conceal-an-object", "hide", "sneak"]) {
    assert.equal(byId.get(id).target.mode, "multiple", id);
    assert.equal(byId.get(id).execution.sharedRoll, true, `${id}: shared-roll execution`);
    assert.notEqual(byId.get(id).execution.singleTargetOnly, true, `${id}: no single-target execution guard`);
  }
  const review = await readFile(new URL("docs/FULL_ACTION_CATALOG_INTEGRATION_REVIEW.md", root), "utf8");
  assert.match(review, /Shared Roll \/ Multi-Target Resolution/);
  assert.match(review, /Prerequisite & Equipment Validation/);
});
