import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CriticalForgeIntegration,
  collectSharedCriticalGroups
} from "../scripts/core/critical-forge-integration.js";

function makeCollection(values = []) {
  const list = [...values];
  list.get = (id) => list.find((entry) => entry?.id === id) ?? null;
  return list;
}

function setupGame({ module = null, enabled = true, message = null } = {}) {
  const modules = makeCollection(module ? [module] : []);
  const messages = makeCollection(message ? [message] : []);
  globalThis.game = {
    user: { id: "gm", name: "GM", isGM: true, active: true },
    users: makeCollection([{ id: "gm", name: "GM", isGM: true, active: true }]),
    modules,
    messages,
    settings: {
      get: (moduleId, key) => {
        if (moduleId === "pf2e-critical-forge" && key === "enableCriticalForge") return enabled;
        return null;
      }
    }
  };
}

test("rc.3 collapses a shared roll to at most one event per critical category", () => {
  const successA = { actorUuid: "Actor.a", outcome: "criticalSuccess" };
  const successB = { actorUuid: "Actor.b", outcome: "criticalSuccess" };
  const failureA = { actorUuid: "Actor.c", outcome: "criticalFailure" };
  const groups = collectSharedCriticalGroups([
    successA,
    { actorUuid: "Actor.d", outcome: "success" },
    successB,
    failureA,
    { actorUuid: "Actor.e", outcome: "failure" }
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].category, "skillCheckCriticalSuccess");
  assert.equal(groups[0].degreeOfSuccess, 3);
  assert.equal(groups[0].representative, successA);
  assert.equal(groups[0].targets.length, 2);
  assert.equal(groups[1].category, "skillCheckCriticalFailure");
  assert.equal(groups[1].degreeOfSuccess, 0);
  assert.equal(groups[1].representative, failureA);
  assert.equal(groups[1].targets.length, 1);
});

test("rc.3 Critical Forge bridge is optional and silent when the module is absent", async () => {
  const oldGame = globalThis.game;
  try {
    setupGame();
    const bridge = new CriticalForgeIntegration();
    assert.equal(bridge.isAvailable(), false);
    const result = await bridge.processSharedRoll({
      definition: { id: "sneak", execution: { statistic: "stealth" } },
      sourceActor: { uuid: "Actor.source" },
      snapshot: { dieResult: 20 },
      resolutions: [{ actorUuid: "Actor.target", outcome: "criticalSuccess" }],
      rollMessageId: "msg"
    });
    assert.equal(result.ok, true);
    assert.equal(result.skipped, true);
    assert.equal(result.reason, "critical-forge-unavailable");
  } finally {
    globalThis.game = oldGame;
  }
});

test("rc.3 shared criticals use Critical Forge public automation with explicit skill context", async () => {
  const oldGame = globalThis.game;
  const oldFromUuid = globalThis.fromUuid;
  const oldChatMessage = globalThis.ChatMessage;
  try {
    const calls = [];
    const sourceActor = { id: "source", uuid: "Actor.source", name: "Rogue", type: "character" };
    const successA = { id: "a", uuid: "Actor.a", name: "Guard A", type: "npc" };
    const successB = { id: "b", uuid: "Actor.b", name: "Guard B", type: "npc" };
    const failureA = { id: "c", uuid: "Actor.c", name: "Ancient Watcher", type: "npc" };
    const tokens = new Map([
      ["Scene.s.Token.a", { uuid: "Scene.s.Token.a", actor: successA }],
      ["Scene.s.Token.b", { uuid: "Scene.s.Token.b", actor: successB }],
      ["Scene.s.Token.c", { uuid: "Scene.s.Token.c", actor: failureA }]
    ]);
    globalThis.fromUuid = async (uuid) => tokens.get(uuid) ?? null;
    globalThis.ChatMessage = { getSpeaker: ({ actor }) => ({ actor: actor?.id, alias: actor?.name }) };

    const sourceMessage = {
      id: "shared-msg",
      uuid: "ChatMessage.shared-msg",
      speaker: { actor: sourceActor.id, alias: sourceActor.name },
      author: { id: "player", name: "Player" },
      rolls: [{ total: 31 }],
      flags: { pf2e: { context: { options: ["action:sneak"] } } }
    };
    const api = {
      cards: {
        capabilities: { skillCheckCriticals: true },
        automation: {
          processMessage: async (syntheticMessage, options) => {
            const resolved = await options.resolveMessageInput();
            calls.push({ syntheticMessage, options, resolved });
            return { valid: true, code: null };
          }
        }
      }
    };
    setupGame({
      enabled: true,
      message: sourceMessage,
      module: { id: "pf2e-critical-forge", active: true, api }
    });

    const bridge = new CriticalForgeIntegration();
    assert.equal(bridge.isAvailable(), true);
    const result = await bridge.processSharedRoll({
      definition: { id: "sneak", execution: { statistic: "stealth" } },
      sourceActor,
      snapshot: { total: 31, dieResult: 20 },
      resolutions: [
        { actorUuid: successA.uuid, tokenUuid: "Scene.s.Token.a", outcome: "criticalSuccess", targetActor: successA },
        { actorUuid: successB.uuid, tokenUuid: "Scene.s.Token.b", outcome: "criticalSuccess", targetActor: successB },
        { actorUuid: failureA.uuid, tokenUuid: "Scene.s.Token.c", outcome: "criticalFailure", targetActor: failureA }
      ],
      rollMessageId: sourceMessage.id
    });

    assert.equal(result.ok, true);
    assert.equal(result.skipped, false);
    assert.equal(calls.length, 2, "one event for success and one for failure, not one per target");
    assert.notEqual(calls[0].syntheticMessage.id, calls[1].syntheticMessage.id);

    const successInput = calls.find((call) => call.resolved.input.category === "skillCheckCriticalSuccess").resolved.input;
    assert.equal(successInput.degreeOfSuccess, 3);
    assert.equal(successInput.rollFamily, "skillCheck");
    assert.equal(successInput.skillType, "stealth");
    assert.equal(successInput.actionSlug, "sneak");
    assert.equal(successInput.sourceActor, sourceActor);
    assert.equal(successInput.targetActor, successA, "first critical-success target is representative");
    assert.equal(successInput.targetTokens.length, 2, "all critical-success token targets propagate for snapshot target count");
    assert.ok(successInput.rollOptions.includes("action-forge:shared-roll"));

    const failureInput = calls.find((call) => call.resolved.input.category === "skillCheckCriticalFailure").resolved.input;
    assert.equal(failureInput.degreeOfSuccess, 0);
    assert.equal(failureInput.targetActor, failureA);
    assert.equal(failureInput.targetTokens.length, 1);

    const repeated = await bridge.processSharedRoll({
      definition: { id: "sneak", execution: { statistic: "stealth" } },
      sourceActor,
      snapshot: { total: 31, dieResult: 20 },
      resolutions: [
        { actorUuid: successA.uuid, tokenUuid: "Scene.s.Token.a", outcome: "criticalSuccess", targetActor: successA },
        { actorUuid: failureA.uuid, tokenUuid: "Scene.s.Token.c", outcome: "criticalFailure", targetActor: failureA }
      ],
      rollMessageId: sourceMessage.id
    });
    assert.equal(calls.length, 2, "bridge de-duplicates repeated resolution of the same message/category");
    assert.ok(repeated.processed.every((entry) => entry.skipped === true));
  } finally {
    globalThis.game = oldGame;
    globalThis.fromUuid = oldFromUuid;
    globalThis.ChatMessage = oldChatMessage;
  }
});

test("rc.3 bridge respects the Critical Forge master enable setting", async () => {
  const oldGame = globalThis.game;
  try {
    let calls = 0;
    const api = {
      cards: {
        capabilities: { skillCheckCriticals: true },
        automation: { processMessage: async () => { calls += 1; return { valid: true }; } }
      }
    };
    setupGame({ enabled: false, module: { id: "pf2e-critical-forge", active: true, api } });
    const bridge = new CriticalForgeIntegration();
    assert.equal(bridge.isAvailable(), false);
    const result = await bridge.processSharedRoll({
      definition: { id: "lie", execution: { statistic: "deception" } },
      sourceActor: { uuid: "Actor.source" },
      snapshot: { dieResult: 1 },
      resolutions: [{ actorUuid: "Actor.target", outcome: "criticalFailure" }]
    });
    assert.equal(result.skipped, true);
    assert.equal(result.reason, "critical-forge-disabled");
    assert.equal(calls, 0);
  } finally {
    globalThis.game = oldGame;
  }
});
