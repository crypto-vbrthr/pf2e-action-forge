import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const DEV14_CORE_IDS = ["escape", "sense-motive", "seek", "aid"];
const EXPLORATION_IDS = [
  "exploration-search",
  "follow-the-expert",
  "sustain-an-effect",
  "hustle",
  "detect-magic-exploration",
  "scout",
  "avoid-notice-exploration",
  "investigate-exploration",
  "defend-exploration",
  "repeat-a-spell"
];

async function catalog() {
  const { CORE_ACTIONS } = await import(`../scripts/data/core-action-catalog.js?dev14=${Date.now()}-${Math.random()}`);
  return { CORE_ACTIONS, byId: new Map(CORE_ACTIONS.map((action) => [action.id, action])) };
}

test("dev.14 adds four core utility actions and all ten common Player Core exploration activities", async () => {
  const { CORE_ACTIONS, byId } = await catalog();
  assert.equal(CORE_ACTIONS.length, 65);
  assert.equal(new Set(CORE_ACTIONS.map((action) => action.id)).size, 65);
  for (const id of [...DEV14_CORE_IDS, ...EXPLORATION_IDS]) assert.ok(byId.has(id), `${id} should be registered`);
});

test("exploration activities are persistent activity definitions rather than fake immediate checks", async () => {
  const { byId } = await catalog();
  for (const id of EXPLORATION_IDS) {
    const action = byId.get(id);
    assert.equal(action.execution.enabled, true, `${id} should be enabled`);
    assert.equal(action.execution.mode, "exploration-activity", `${id} should persist exploration state`);
    assert.equal(action.dc.strategy, "none", `${id} should not invent an immediate DC`);
    assert.deepEqual(action.visibility, { announcement: "none", roll: "none", outcome: "none" });
  }

  const follow = byId.get("follow-the-expert");
  assert.equal(follow.target.mode, "single");
  assert.equal(follow.target.required, true);
  assert.equal(follow.execution.requiresStatistic, true);
  assert.equal(follow.execution.includeLore, true);
  assert.equal(follow.execution.statisticLabel, "PF2EActionForge.Exploration.FollowExpertSkillLabel");
});

test("core utility actions preserve their distinct target, DC, statistic, and secret-result models", async () => {
  const { byId } = await catalog();
  const escape = byId.get("escape");
  assert.deepEqual(escape.execution.statistics, ["unarmed", "acrobatics", "athletics"]);
  assert.equal(escape.execution.requiresStatistic, true);
  assert.equal(escape.dc.strategy, "target-defense");
  assert.equal(escape.dc.defense, "athletics");
  assert.equal(escape.dc.manualFallback, true);
  assert.equal(escape.target.required, false);

  const motive = byId.get("sense-motive");
  assert.equal(motive.execution.statistic, "perception");
  assert.equal(motive.dc.defense, "deception");
  assert.equal(motive.visibility.roll, "blind");
  assert.equal(motive.visibility.outcome, "gm");

  const seek = byId.get("seek");
  assert.equal(seek.execution.statistic, "perception");
  assert.equal(seek.dc.strategy, "none");
  assert.equal(seek.visibility.roll, "blind");

  const aid = byId.get("aid");
  assert.equal(aid.dc.strategy, "fixed-choice");
  assert.equal(aid.dc.allowCustom, true);
  assert.equal(aid.dc.choices[0].value, 15);
  assert.equal(aid.execution.requiresStatistic, true);
  assert.equal(aid.execution.includeLore, true);
});

test("ActionRegistry retains exploration mode and custom statistic labels through normalization", async () => {
  const { byId } = await catalog();
  const { ActionRegistry } = await import(`../scripts/core/action-registry.js?dev14-registry=${Date.now()}`);
  const registry = new ActionRegistry();
  const follow = registry.register(byId.get("follow-the-expert"));
  assert.equal(follow.execution.mode, "exploration-activity");
  assert.equal(follow.execution.statisticLabel, "PF2EActionForge.Exploration.FollowExpertSkillLabel");
  assert.equal(follow.execution.statisticHint, "PF2EActionForge.Exploration.FollowExpertSkillHint");
  assert.ok(Object.isFrozen(follow.execution));
});

test("DCResolver resolves skill DCs used by Escape and Sense Motive from Actor statistics", async () => {
  const { byId } = await catalog();
  const oldGame = globalThis.game;
  try {
    globalThis.game = { user: { isGM: false } };
    const { DCResolver } = await import(`../scripts/core/dc-resolver.js?dev14-skill-dcs=${Date.now()}`);
    const actor = {
      getStatistic: (slug) => ({ athletics: { dc: { value: 24 } }, deception: { dc: { value: 27 } } })[slug] ?? null
    };
    const targetState = { targets: [{ actor, token: null, name: "Target" }] };
    const resolver = new DCResolver();
    const escape = resolver.getState(byId.get("escape"), targetState, { manualDc: null, actor: null, statistic: "athletics" });
    const motive = resolver.getState(byId.get("sense-motive"), targetState, { manualDc: null, actor: null, statistic: "perception" });
    assert.equal(escape.valid, true);
    assert.equal(escape.difficultyClass, 24);
    assert.equal(motive.valid, true);
    assert.equal(motive.difficultyClass, 27);
  } finally {
    globalThis.game = oldGame;
  }
});

test("PF2e adapter treats exploration activities as state changes and still delegates core utilities to system actions", async () => {
  const { byId } = await catalog();
  const oldGame = globalThis.game;
  try {
    let used = null;
    globalThis.game = {
      pf2e: { actions: new Map([["escape", { slug: "escape", use: async (options) => { used = options; return []; } }]]) },
      i18n: { localize: (key) => key }
    };
    const { PF2eActionAdapter } = await import(`../scripts/core/pf2e-action-adapter.js?dev14-adapter=${Date.now()}`);
    const adapter = new PF2eActionAdapter();
    const activity = await adapter.execute({ definition: byId.get("scout"), actor: { uuid: "Actor.scout" } });
    assert.deepEqual(activity, { ok: true, action: null, activity: true, explorationActivity: true, results: [] });

    const source = { uuid: "Actor.source" };
    await adapter.execute({ definition: byId.get("escape"), actor: source, difficultyClass: 24, statistic: "athletics" });
    assert.equal(used.actors, source);
    assert.equal(used.difficultyClass, 24);
    assert.equal(used.statistic, "athletics");
  } finally {
    globalThis.game = oldGame;
  }
});

test("ExplorationActivityService stores, replaces, reads, and clears one activity on an owned Actor", async () => {
  const oldGame = globalThis.game;
  const oldConst = globalThis.CONST;
  try {
    globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3 } };
    globalThis.game = { user: { id: "player", isGM: false } };
    let flag = null;
    const actor = {
      uuid: "Actor.hero",
      type: "character",
      flags: {},
      testUserPermission: (user, level) => user.id === "player" && level === 3,
      getFlag: () => flag,
      setFlag: async (_scope, _key, value) => { flag = value; },
      unsetFlag: async () => { flag = null; }
    };
    const { ExplorationActivityService } = await import(`../scripts/core/exploration-activity-service.js?dev14-service=${Date.now()}`);
    const service = new ExplorationActivityService();
    const definition = { id: "scout", execution: { mode: "exploration-activity" } };
    const stored = await service.set(actor, definition);
    assert.equal(stored.ok, true);
    assert.equal(service.get(actor).actionId, "scout");
    assert.equal(service.get(actor).sourceUserId, "player");

    const follow = { id: "follow-the-expert", execution: { mode: "exploration-activity" } };
    await service.set(actor, follow, {
      statistic: "stealth",
      targetEntry: { actorUuid: "Actor.expert", name: "Expert", source: "picker" }
    });
    assert.deepEqual(
      { actionId: service.get(actor).actionId, statistic: service.get(actor).statistic, target: service.get(actor).targetActorUuid },
      { actionId: "follow-the-expert", statistic: "stealth", target: "Actor.expert" }
    );

    const cleared = await service.clear(actor);
    assert.equal(cleared.ok, true);
    assert.equal(service.get(actor), null);
  } finally {
    globalThis.game = oldGame;
    globalThis.CONST = oldConst;
  }
});

test("dev.14 UI exposes the persistent activity banner, clear control, exploration workflow hint, and matching localization", async () => {
  const template = await readFile(new URL("templates/action-forge.hbs", root), "utf8");
  const css = await readFile(new URL("styles/action-forge.css", root), "utf8");
  const bootstrap = await readFile(new URL("scripts/action-forge.js", root), "utf8");
  const de = JSON.parse(await readFile(new URL("lang/de.json", root), "utf8"));
  const en = JSON.parse(await readFile(new URL("lang/en.json", root), "utf8"));

  assert.match(template, /activeExploration/);
  assert.match(template, /data-action="clearExplorationActivity"/);
  assert.match(template, /af-exploration-workflow-note/);
  assert.match(css, /\.af-exploration-active/);
  assert.match(bootstrap, /explorationActivityService/);
  assert.equal(de["PF2EActionForge.Categories.Exploration"], "Erkundungsaktivitäten");
  assert.equal(en["PF2EActionForge.Categories.Exploration"], "Exploration Activities");
});
