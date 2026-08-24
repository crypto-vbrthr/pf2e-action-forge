import assert from "node:assert/strict";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

test("DC Resolver uses a target defense and retains the target token", async () => {
  const { DCResolver } = await import(`../scripts/core/dc-resolver.js?target-defense=${Date.now()}`);
  const resolver = new DCResolver();
  const actor = { uuid: "Actor.target", name: "Target" };
  const token = { uuid: "Scene.scene.Token.target", actor };
  const action = { dc: { strategy: "target-defense", defense: "reflex", manualFallback: true } };
  const targetState = { targets: [{ actor, token, name: actor.name }] };

  const state = resolver.getState(action, targetState);
  assert.equal(state.valid, true);
  assert.equal(state.source, "target");
  assert.equal(state.difficultyClass, "reflex");
  assert.equal(state.target.actor, actor);

  const resolved = resolver.resolve(action, targetState);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.difficultyClass, "reflex");
  assert.equal(resolved.target, token);
});

test("DC Resolver routes target-defense fallback to the GM and accepts a GM-entered fallback", async () => {
  const { DCResolver } = await import(`../scripts/core/dc-resolver.js?fallback=${Date.now()}`);
  const resolver = new DCResolver();
  const action = { dc: { strategy: "target-defense", defense: "reflex", manualFallback: true } };
  const emptyTargets = { targets: [] };

  const player = resolver.getState(action, emptyTargets, { manualDc: "27", user: { isGM: false } });
  assert.equal(player.valid, true);
  assert.equal(player.source, "gm");
  assert.equal(player.requiresGmHandoff, true);
  assert.equal(player.difficultyClass, undefined);

  const gmMissing = resolver.getState(action, emptyTargets, { user: { isGM: true } });
  assert.equal(gmMissing.valid, false);
  const state = resolver.getState(action, emptyTargets, { manualDc: "27", user: { isGM: true } });
  assert.equal(state.valid, true);
  assert.equal(state.source, "manual");
  assert.equal(state.difficultyClass, 27);
  assert.equal(state.target, null);
});

test("DC Resolver validates GM-entered manual DCs for environmental actions", async () => {
  const { DCResolver, normalizeManualDc } = await import(`../scripts/core/dc-resolver.js?manual=${Date.now()}`);
  const resolver = new DCResolver();
  const climb = { dc: { strategy: "manual" } };

  assert.equal(normalizeManualDc("20"), 20);
  assert.equal(normalizeManualDc("20.5"), null);
  assert.equal(normalizeManualDc("61"), null);
  assert.equal(resolver.getState(climb, { targets: [] }, { manualDc: "", user: { isGM: true } }).valid, false);
  const resolved = resolver.resolve(climb, { targets: [] }, { manualDc: 18, user: { isGM: true } });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.difficultyClass, 18);
  assert.equal(resolved.target, null);
});

test("PF2e Action Adapter delegates actor, target, statistic, and DC to the system action", async () => {
  const oldGame = globalThis.game;
  const calls = [];
  const result = { roll: { total: 31 }, outcome: "success" };
  const systemAction = {
    slug: "tumble-through",
    use: async (options) => {
      calls.push(options);
      return [result];
    }
  };

  try {
    globalThis.game = {
      pf2e: {
        actions: {
          get: (slug) => slug === "tumble-through" ? systemAction : null
        }
      }
    };

    const { PF2eActionAdapter } = await import(`../scripts/core/pf2e-action-adapter.js?adapter=${Date.now()}`);
    const adapter = new PF2eActionAdapter();
    const actor = { uuid: "Actor.source" };
    const target = { uuid: "Scene.scene.Token.target" };
    const definition = {
      id: "tumble-through",
      systemAction: { slug: "tumble-through" },
      execution: { enabled: true, statistic: "acrobatics" }
    };

    assert.equal(adapter.isAvailable(definition), true);
    const execution = await adapter.execute({
      definition,
      actor,
      target,
      difficultyClass: "reflex",
      event: null
    });

    assert.equal(execution.ok, true);
    assert.deepEqual(execution.results, [result]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].actors, actor);
    assert.equal(calls[0].target, target);
    assert.equal(calls[0].difficultyClass, "reflex");
    assert.equal(calls[0].statistic, "acrobatics");
    assert.deepEqual(calls[0].message, { create: true });
  } finally {
    globalThis.game = oldGame;
  }
});

test("DC Resolver resolves an Actor-only sidebar defense to a concrete PF2e DC", async () => {
  const { DCResolver } = await import(`../scripts/core/dc-resolver.js?sidebar-defense=${Date.now()}`);
  const resolver = new DCResolver();
  const actor = {
    uuid: "Actor.sidebar",
    name: "Sidebar Target",
    getStatistic: (slug) => slug === "reflex" ? { dc: { value: 29 } } : null
  };
  const action = { dc: { strategy: "target-defense", defense: "reflex", manualFallback: true } };
  const targetState = {
    targets: [{ source: "sidebar", actor, token: null, name: actor.name }]
  };

  const state = resolver.getState(action, targetState);
  assert.equal(state.valid, true);
  assert.equal(state.source, "target");
  assert.equal(state.difficultyClass, 29);
  assert.equal(state.defenseValue, 29);

  const resolved = resolver.resolve(action, targetState);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.difficultyClass, 29);
  assert.equal(resolved.target, actor);
});

test("canvas-token defense targets keep the PF2e defense slug for full target context", async () => {
  const { DCResolver } = await import(`../scripts/core/dc-resolver.js?canvas-defense=${Date.now()}`);
  const resolver = new DCResolver();
  const actor = {
    uuid: "Actor.canvas",
    getStatistic: () => ({ dc: { value: 31 } })
  };
  const token = { actor };
  const action = { dc: { strategy: "target-defense", defense: "reflex", manualFallback: true } };
  const state = resolver.getState(action, { targets: [{ source: "canvas", actor, token }] });

  assert.equal(state.difficultyClass, "reflex");
  assert.equal(state.defenseValue, null);
});


test("PF2e Action Adapter can execute a direct PF2e statistic when no system action exists", async () => {
  const oldGame = globalThis.game;
  const calls = [];
  const message = { id: "message-treat-wounds" };
  const roll = { total: 27, degreeOfSuccess: 2 };
  const medicine = {
    roll: async (options) => {
      calls.push(options);
      await options.callback?.(roll, "success", message, null);
      return roll;
    }
  };

  try {
    globalThis.game = {
      i18n: { localize: (key) => key },
      pf2e: { actions: { get: () => null } }
    };

    const { PF2eActionAdapter } = await import(`../scripts/core/pf2e-action-adapter.js?statistic-adapter=${Date.now()}`);
    const adapter = new PF2eActionAdapter();
    const actor = { getStatistic: (slug) => slug === "medicine" ? medicine : null };
    const targetActor = { getSelfRollOptions: () => [] };
    const definition = {
      id: "treat-wounds",
      label: "PF2EActionForge.Actions.TreatWounds.Name",
      execution: { enabled: true, mode: "statistic", statistic: "medicine" },
      visibility: { roll: "public" }
    };

    assert.equal(adapter.isAvailable(definition), true, "direct statistic actions do not depend on game.pf2e.actions");
    const execution = await adapter.execute({
      definition,
      actor,
      target: targetActor,
      difficultyClass: 20,
      statistic: "medicine"
    });

    assert.equal(execution.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].action, "treat-wounds");
    assert.equal(calls[0].identifier, "treat-wounds");
    assert.deepEqual(calls[0].dc, { value: 20, visible: true });
    assert.equal(calls[0].target, targetActor);
    assert.equal(calls[0].createMessage, true);
    assert.equal(execution.results[0].roll, roll);
    assert.equal(execution.results[0].outcome, "success");
    assert.equal(execution.results[0].message, message);
  } finally {
    globalThis.game = oldGame;
  }
});

test("direct statistic execution still works for UUID-only picker targets", async () => {
  const oldGame = globalThis.game;
  const roll = { total: 19, degreeOfSuccess: 1 };
  let optionsSeen = null;
  try {
    globalThis.game = { i18n: { localize: (key) => key }, pf2e: { actions: {} } };
    const { PF2eActionAdapter } = await import(`../scripts/core/pf2e-action-adapter.js?uuid-only-stat=${Date.now()}`);
    const adapter = new PF2eActionAdapter();
    const actor = {
      getStatistic: () => ({
        roll: async (options) => {
          optionsSeen = options;
          await options.callback?.(roll, "failure", { id: "msg" }, null);
          return roll;
        }
      })
    };
    const definition = {
      id: "treat-wounds",
      label: "Treat Wounds",
      execution: { enabled: true, mode: "statistic", statistic: "medicine" },
      visibility: { roll: "public" }
    };

    const execution = await adapter.execute({
      definition,
      actor,
      target: { actorUuid: "Actor.other-player", name: "Other PC" },
      difficultyClass: 20
    });
    assert.equal(execution.ok, true);
    assert.equal(execution.results[0].outcome, "failure");
    assert.equal("target" in optionsSeen, false, "unknown remote Actor is not required to make the fixed-DC Medicine check");
  } finally {
    globalThis.game = oldGame;
  }
});
