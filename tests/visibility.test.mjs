import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("Action Registry normalizes and freezes visibility/execution metadata", async () => {
  const { ActionRegistry } = await import("../scripts/core/action-registry.js");
  const registry = new ActionRegistry();
  const action = registry.register({
    id: "secret-test",
    label: "Secret.Test",
    execution: { enabled: true, statistics: ["arcana"], includeLore: true, requiresStatistic: true, singleTargetOnly: true },
    visibility: { announcement: "player-gm", roll: "blind", outcome: "gm" },
    dc: { strategy: "gm-defined", systemTargetFallback: true, systemTargetRequiresStatisticMatch: true, allowUnknown: true, systemTargetStatistics: ["arcana"] }
  });

  assert.deepEqual(action.visibility, { announcement: "player-gm", roll: "blind", outcome: "gm" });
  assert.deepEqual(action.execution.statistics, ["arcana"]);
  assert.equal(action.execution.includeLore, true);
  assert.equal(action.execution.requiresStatistic, true);
  assert.equal(action.execution.singleTargetOnly, true);
  assert.equal(action.dc.systemTargetFallback, true);
  assert.equal(action.dc.systemTargetRequiresStatisticMatch, true);
  assert.equal(action.dc.allowUnknown, true);
  assert.deepEqual(action.dc.systemTargetStatistics, ["arcana"]);
  assert.ok(Object.isFrozen(action.visibility));
  assert.ok(Object.isFrozen(action.execution.statistics));
});

test("Visibility Engine enforces secret roll traits and hides local results from players", async () => {
  const oldGame = globalThis.game;
  try {
    globalThis.game = { user: { id: "player", isGM: false } };
    const { VisibilityEngine } = await import(`../scripts/core/visibility-engine.js?visibility=${Date.now()}`);
    const engine = new VisibilityEngine();
    const definition = { visibility: { announcement: "none", roll: "blind", outcome: "gm" } };

    assert.deepEqual(engine.getRollTraits(definition, { traits: [] }), ["secret"]);
    assert.deepEqual(engine.getRollTraits(definition, { traits: ["secret"] }), []);
    assert.equal(engine.shouldRevealLocalResult(definition, globalThis.game.user), false);
    assert.equal(engine.shouldRevealLocalResult(definition, { id: "gm", isGM: true }), true);
  } finally {
    globalThis.game = oldGame;
  }
});

test("Visibility Engine resolves player/GM announcement recipients without duplicates", async () => {
  const oldGame = globalThis.game;
  try {
    const player = { id: "player", isGM: false, active: true };
    const gm = { id: "gm", isGM: true, active: true };
    const inactiveGm = { id: "old-gm", isGM: true, active: false };
    globalThis.game = { user: player, users: [player, gm, inactiveGm] };
    const { VisibilityEngine } = await import(`../scripts/core/visibility-engine.js?recipients=${Date.now()}`);
    const engine = new VisibilityEngine();

    assert.deepEqual(engine.getRecipients("player-gm"), ["player", "gm"]);
    assert.deepEqual(engine.getRecipients("gm"), ["gm"]);
    assert.deepEqual(engine.getRecipients("self"), ["player"]);
    assert.deepEqual(engine.getRecipients("public"), []);
  } finally {
    globalThis.game = oldGame;
  }
});

test("Recall Knowledge DC delegates only eligible standard target skills and otherwise leaves the secret DC to the GM", async () => {
  const { DCResolver } = await import("../scripts/core/dc-resolver.js");
  const resolver = new DCResolver();
  const actor = { type: "npc", name: "Unknown Beast", identificationDCs: { skills: new Set(["nature"]) } };
  const targetState = { targets: [{ actor, name: actor.name }] };
  const action = {
    dc: {
      strategy: "gm-defined",
      systemTargetFallback: true,
      systemTargetRequiresStatisticMatch: true,
      allowUnknown: true,
      systemTargetStatistics: ["arcana", "nature", "religion"]
    }
  };

  const standard = resolver.getState(action, targetState, { statistic: "nature" });
  assert.equal(standard.valid, true);
  assert.equal(standard.source, "system-target");
  assert.equal(standard.difficultyClass, undefined);

  const wrongStandard = resolver.getState(action, targetState, { statistic: "arcana" });
  assert.equal(wrongStandard.valid, true);
  assert.equal(wrongStandard.source, "gm");
  assert.equal(wrongStandard.difficultyClass, undefined);

  const lore = resolver.getState(action, targetState, { statistic: "dragon-lore" });
  assert.equal(lore.valid, true);
  assert.equal(lore.source, "gm");
  assert.equal(lore.difficultyClass, undefined);

  const loreManual = resolver.getState(action, targetState, { statistic: "dragon-lore", manualDc: 21, user: { isGM: true } });
  assert.equal(loreManual.valid, true);
  assert.equal(loreManual.source, "manual");
  assert.equal(loreManual.difficultyClass, 21);
});

test("PF2e adapter passes a chosen statistic and secret trait without replacing system action behavior", async () => {
  const oldGame = globalThis.game;
  let received = null;
  try {
    globalThis.game = {
      pf2e: {
        actions: {
          get: () => ({
            traits: [],
            use: async (options) => {
              received = options;
              return [];
            }
          })
        }
      }
    };
    const { PF2eActionAdapter } = await import(`../scripts/core/pf2e-action-adapter.js?secret=${Date.now()}`);
    const adapter = new PF2eActionAdapter();
    const definition = {
      id: "recall-knowledge",
      systemAction: { slug: "recall-knowledge" },
      execution: { enabled: true, statistic: null },
      visibility: { roll: "blind", outcome: "gm", announcement: "player-gm" }
    };
    const actor = { uuid: "Actor.test" };
    const result = await adapter.execute({ definition, actor, statistic: "nature" });
    assert.equal(result.ok, true);
    assert.equal(received.statistic, "nature");
    assert.deepEqual(received.traits, ["secret"]);
  } finally {
    globalThis.game = oldGame;
  }
});

test("application code suppresses secret totals/outcomes in the player's local summary", async () => {
  const app = await readFile(new URL("scripts/ui/action-forge-app.js", root), "utf8");
  assert.match(app, /visibilityEngine\.shouldRevealLocalResult/);
  assert.match(app, /hiddenText: game\.i18n\.localize\("PF2EActionForge\.Roll\.HiddenResult"\)/);
  assert.match(app, /visibilityEngine\.createAnnouncement/);
  assert.match(app, /execution-statistic/);
});


test("workspace uses one outer vertical scrollbar so active-action controls cannot be clipped", async () => {
  const css = await readFile(new URL("styles/action-forge.css", root), "utf8");
  assert.match(css, /\.pf2e-action-forge \.af-shell \{[\s\S]*height: 100%;[\s\S]*min-height: 0;[\s\S]*overflow-y: auto;[\s\S]*scrollbar-gutter: stable;/);
  assert.match(css, /\.pf2e-action-forge \.af-actions \{[\s\S]*flex: 0 0 auto;[\s\S]*overflow: visible;/);
  assert.match(css, /\.af-shell::-webkit-scrollbar/);
});


test("players cannot override GM-defined or secret DCs", async () => {
  const { DCResolver } = await import(`../scripts/core/dc-resolver.js?gm-dc-permissions=${Date.now()}`);
  const resolver = new DCResolver();
  const actor = { type: "npc", name: "Hidden Creature", identificationDCs: { skills: new Set(["nature"]) } };
  const targetState = { targets: [{ actor, name: actor.name }] };
  const action = {
    dc: {
      strategy: "gm-defined",
      systemTargetFallback: true,
      systemTargetRequiresStatisticMatch: true,
      allowUnknown: true,
      systemTargetStatistics: ["nature"]
    }
  };

  const playerInjected = resolver.getState(action, targetState, {
    statistic: "dragon-lore",
    manualDc: 1,
    user: { id: "player", isGM: false }
  });
  assert.equal(playerInjected.valid, true);
  assert.equal(playerInjected.source, "gm");
  assert.equal(playerInjected.difficultyClass, undefined);
  assert.equal(playerInjected.manualDc, null);
  assert.equal(playerInjected.allowsManualDc, false);

  const gmManual = resolver.getState(action, targetState, {
    statistic: "dragon-lore",
    manualDc: 23,
    user: { id: "gm", isGM: true }
  });
  assert.equal(gmManual.source, "manual");
  assert.equal(gmManual.difficultyClass, 23);
  assert.equal(gmManual.allowsManualDc, true);
});

test("GM-defined manual DC field is rendered only when the resolver allows it", async () => {
  const app = await readFile(new URL("scripts/ui/action-forge-app.js", root), "utf8");
  assert.match(app, /state\.strategy === "gm-defined" && state\.allowsManualDc/);
  assert.match(app, /action\?\.dc\?\.strategy === "gm-defined" && !game\.user\?\.isGM/);
});
