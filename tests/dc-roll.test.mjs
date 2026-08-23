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

test("DC Resolver accepts manual fallback for target-defense actions without a target", async () => {
  const { DCResolver } = await import(`../scripts/core/dc-resolver.js?fallback=${Date.now()}`);
  const resolver = new DCResolver();
  const action = { dc: { strategy: "target-defense", defense: "reflex", manualFallback: true } };
  const emptyTargets = { targets: [] };

  assert.equal(resolver.getState(action, emptyTargets).valid, false);
  const state = resolver.getState(action, emptyTargets, { manualDc: "27" });
  assert.equal(state.valid, true);
  assert.equal(state.source, "manual");
  assert.equal(state.difficultyClass, 27);
  assert.equal(state.target, null);
});

test("DC Resolver validates manual DCs for environmental actions", async () => {
  const { DCResolver, normalizeManualDc } = await import(`../scripts/core/dc-resolver.js?manual=${Date.now()}`);
  const resolver = new DCResolver();
  const climb = { dc: { strategy: "manual" } };

  assert.equal(normalizeManualDc("20"), 20);
  assert.equal(normalizeManualDc("20.5"), null);
  assert.equal(normalizeManualDc("61"), null);
  assert.equal(resolver.getState(climb, { targets: [] }, { manualDc: "" }).valid, false);
  const resolved = resolver.resolve(climb, { targets: [] }, { manualDc: 18 });
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
