import assert from "node:assert/strict";
import { test } from "node:test";

import { ActionRegistry, actionRegistry } from "../scripts/core/action-registry.js";
import { DCResolver } from "../scripts/core/dc-resolver.js";
import { PF2eActionAdapter } from "../scripts/core/pf2e-action-adapter.js";
import {
  SharedRollResolver,
  SHARED_ROLL_QUERY_NAME,
  degreeOfSuccess,
  snapshotSharedRoll
} from "../scripts/core/shared-roll-resolver.js";
import { CORE_ACTIONS } from "../scripts/data/core-action-catalog.js";

const byId = new Map(CORE_ACTIONS.map((action) => [action.id, action]));

function makeRoll(total, dieResult) {
  return {
    total,
    dice: [{ faces: 20, total: dieResult, results: [{ result: dieResult, active: true }] }]
  };
}

test("dev.16 catalog and ActionRegistry expose the shared-roll contract", () => {
  const ids = ["palm-an-object", "create-a-diversion", "lie", "conceal-an-object", "hide", "sneak"];
  const registry = new ActionRegistry();
  registry.registerMany(ids.map((id) => byId.get(id)));

  for (const id of ids) {
    const raw = byId.get(id);
    const normalized = registry.get(id);
    assert.equal(raw.target.mode, "multiple", id);
    assert.equal(raw.execution.sharedRoll, true, id);
    assert.notEqual(raw.execution.singleTargetOnly, true, id);
    assert.equal(normalized.execution.sharedRoll, true, `${id}: normalized sharedRoll`);
    assert.ok(Object.isFrozen(normalized.execution), `${id}: execution is frozen`);
  }
});

test("shared target DC state never binds the one roll to the first target", () => {
  const resolver = new DCResolver();
  const action = byId.get("create-a-diversion");
  const first = { name: "Guard A", actor: { getStatistic: () => ({ dc: { value: 19 } }) } };
  const second = { name: "Guard B", actor: { getStatistic: () => ({ dc: { value: 27 } }) } };
  const state = resolver.getState(
    action,
    { count: 2, targets: [first, second] },
    { actor: {}, statistic: "deception", user: { id: "p1", isGM: false } }
  );

  assert.equal(state.valid, true);
  assert.equal(state.source, "shared-targets");
  assert.equal(state.targetCount, 2);
  assert.equal(state.defense, "perception");
  assert.equal(state.target, null);
  assert.equal(state.difficultyClass, undefined);
  assert.equal(state.requiresGmHandoff, false);
});

test("shared degree-of-success comparison handles several DCs and natural 20/1 steps", () => {
  assert.equal(degreeOfSuccess(24, 20, 12), "success");
  assert.equal(degreeOfSuccess(24, 25, 12), "failure");
  assert.equal(degreeOfSuccess(24, 34, 12), "criticalFailure");
  assert.equal(degreeOfSuccess(24, 25, 20), "success", "natural 20 raises failure to success");
  assert.equal(degreeOfSuccess(24, 20, 1), "failure", "natural 1 lowers success to failure");

  const snapshot = snapshotSharedRoll(makeRoll(31, 20));
  assert.deepEqual(snapshot, { total: 31, dieResult: 20 });
  assert.ok(Object.isFrozen(snapshot));
});

test("PF2e shared execution rolls exactly once without one target or DC", async () => {
  const oldGame = globalThis.game;
  try {
    const calls = [];
    globalThis.game = { i18n: { localize: (key) => key } };
    const roll = makeRoll(24, 14);
    const actor = {
      getStatistic: (slug) => ({
        roll: async (options) => {
          calls.push({ slug, options });
          options.callback?.(roll, null, { id: "shared-roll-message" });
          return roll;
        }
      })
    };
    const adapter = new PF2eActionAdapter();
    const result = await adapter.executeShared({
      definition: { ...byId.get("create-a-diversion"), execution: { ...byId.get("create-a-diversion").execution, sharedRoll: true } },
      actor,
      statistic: "deception"
    });

    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].slug, "deception");
    assert.equal(Object.hasOwn(calls[0].options, "dc"), false);
    assert.equal(Object.hasOwn(calls[0].options, "target"), false);
    assert.equal(result.results[0].message.id, "shared-roll-message");
  } finally {
    globalThis.game = oldGame;
  }
});

test("GM broker resolves public per-target outcomes but never returns numeric defenses", async () => {
  const oldGame = globalThis.game;
  const oldConfig = globalThis.CONFIG;
  const oldConst = globalThis.CONST;
  const oldFromUuid = globalThis.fromUuid;
  const oldChatMessage = globalThis.ChatMessage;

  try {
    const player = { id: "player", isGM: false, active: true };
    const gm = { id: "gm", isGM: true, active: true };
    const users = [player, gm];
    users.get = (id) => users.find((user) => user.id === id) ?? null;
    users.activeGM = gm;

    const source = {
      documentName: "Actor",
      id: "source",
      uuid: "Actor.source",
      name: "Rogue",
      type: "character",
      testUserPermission: (user) => user.id === player.id
    };
    const targetA = {
      documentName: "Actor",
      id: "a",
      uuid: "Actor.a",
      name: "Guard A",
      type: "npc",
      getStatistic: () => ({ dc: { value: 20 } })
    };
    const targetB = {
      documentName: "Actor",
      id: "b",
      uuid: "Actor.b",
      name: "Guard B",
      type: "npc",
      getStatistic: () => ({ dc: { value: 25 } })
    };
    const targetC = {
      documentName: "Actor",
      id: "c",
      uuid: "Actor.c",
      name: "Guard C",
      type: "npc",
      getStatistic: () => ({ dc: { value: 34 } })
    };
    const tokenA = { documentName: "Token", uuid: "Scene.s.Token.a", hidden: false, actor: targetA };
    const tokenB = { documentName: "Token", uuid: "Scene.s.Token.b", hidden: false, actor: targetB };
    const tokenC = { documentName: "Token", uuid: "Scene.s.Token.c", hidden: false, actor: targetC };
    const documents = new Map([
      [source.uuid, source], [targetA.uuid, targetA], [targetB.uuid, targetB], [targetC.uuid, targetC],
      [tokenA.uuid, tokenA], [tokenB.uuid, tokenB], [tokenC.uuid, tokenC]
    ]);

    const roll = makeRoll(24, 12);
    const message = {
      id: "msg-public",
      author: player,
      speaker: { actor: source.id },
      rolls: [roll],
      flags: { pf2e: { context: { options: new Set(["action:create-a-diversion"]) } } }
    };
    const messages = new Map([[message.id, message]]);
    const created = [];

    globalThis.CONFIG = { queries: {} };
    globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3, LIMITED: 1 } };
    globalThis.fromUuid = async (uuid) => documents.get(uuid) ?? null;
    globalThis.ChatMessage = {
      getSpeaker: ({ actor }) => ({ actor: actor?.id, alias: actor?.name }),
      create: async (data) => { created.push(data); return { id: `summary-${created.length}`, ...data }; }
    };
    globalThis.game = {
      user: player,
      users,
      messages,
      i18n: {
        localize: (key) => ({
          "PF2EActionForge.SharedRoll.GMDc": "DC",
          "PF2EActionForge.SharedRoll.Heading": "Shared roll",
          "PF2EActionForge.SharedRoll.SummaryHint": "One check was compared against every selected target.",
          "PF2EActionForge.Roll.Outcome.success": "Success",
          "PF2EActionForge.Roll.Outcome.failure": "Failure",
          "PF2EActionForge.Roll.Outcome.criticalFailure": "Critical Failure",
          "PF2EActionForge.Actions.CreateADiversion.Name": "Create a Diversion"
        }[key] ?? key)
      }
    };

    actionRegistry.clear();
    actionRegistry.registerMany(CORE_ACTIONS);
    const resolver = new SharedRollResolver();
    resolver.registerQueryHandler();
    assert.equal(typeof globalThis.CONFIG.queries[SHARED_ROLL_QUERY_NAME], "function");

    gm.query = async (name, payload) => {
      assert.equal(name, SHARED_ROLL_QUERY_NAME);
      const previous = globalThis.game.user;
      globalThis.game.user = gm;
      try {
        return await globalThis.CONFIG.queries[name](payload);
      } finally {
        globalThis.game.user = previous;
      }
    };

    const forgedMessage = {
      ...message,
      id: "msg-forged",
      rolls: [makeRoll(24, 12)]
    };
    messages.set(forgedMessage.id, forgedMessage);
    const forged = await resolver.request({
      definition: actionRegistry.get("create-a-diversion"),
      sourceActor: source,
      targets: [{ actorUuid: targetA.uuid, tokenUuid: tokenA.uuid, source: "canvas" }],
      roll: makeRoll(44, 20),
      rollMessageId: forgedMessage.id
    });
    assert.equal(forged.ok, false);
    assert.equal(forged.reason, "roll-mismatch", "broker rejects a client-submitted total that does not match the PF2e message");

    const result = await resolver.request({
      definition: actionRegistry.get("create-a-diversion"),
      sourceActor: source,
      targets: [
        { actorUuid: targetA.uuid, tokenUuid: tokenA.uuid, source: "canvas" },
        { actorUuid: targetB.uuid, tokenUuid: tokenB.uuid, source: "canvas" },
        { actorUuid: targetC.uuid, tokenUuid: tokenC.uuid, source: "canvas" }
      ],
      roll,
      rollMessageId: message.id
    });

    assert.equal(result.ok, true);
    assert.equal(result.targetCount, 3);
    assert.deepEqual(result.results.map((entry) => [entry.name, entry.outcome]), [
      ["Guard A", "success"],
      ["Guard B", "failure"],
      ["Guard C", "criticalFailure"]
    ]);
    for (const entry of result.results) assert.equal(Object.hasOwn(entry, "dc"), false);
    assert.equal(created.length, 1);
    assert.equal(created[0].whisper, undefined, "public summary is public");
    assert.doesNotMatch(created[0].content, /\bDC\s+(20|25|34)\b/, "public summary never contains defenses");

    const reused = await resolver.request({
      definition: actionRegistry.get("create-a-diversion"),
      sourceActor: source,
      targets: [{ actorUuid: targetA.uuid, tokenUuid: tokenA.uuid, source: "canvas" }],
      roll,
      rollMessageId: message.id
    });
    assert.equal(reused.ok, false);
    assert.equal(reused.reason, "roll-already-resolved");
  } finally {
    actionRegistry.clear();
    globalThis.game = oldGame;
    globalThis.CONFIG = oldConfig;
    globalThis.CONST = oldConst;
    globalThis.fromUuid = oldFromUuid;
    globalThis.ChatMessage = oldChatMessage;
  }
});

test("secret shared rolls keep target outcomes and defenses on the GM side", async () => {
  const oldGame = globalThis.game;
  const oldConfig = globalThis.CONFIG;
  const oldConst = globalThis.CONST;
  const oldFromUuid = globalThis.fromUuid;
  const oldChatMessage = globalThis.ChatMessage;

  try {
    const player = { id: "player", isGM: false, active: true };
    const gm = { id: "gm", isGM: true, active: true };
    const users = [player, gm];
    users.get = (id) => users.find((user) => user.id === id) ?? null;
    users.activeGM = gm;
    const source = {
      documentName: "Actor", id: "source", uuid: "Actor.source", name: "Rogue", type: "character",
      testUserPermission: (user) => user.id === player.id
    };
    const target = {
      documentName: "Actor", id: "guard", uuid: "Actor.guard", name: "Guard", type: "npc",
      getStatistic: () => ({ dc: { value: 23 } })
    };
    const token = { documentName: "Token", uuid: "Scene.s.Token.guard", hidden: false, actor: target };
    const roll = makeRoll(27, 15);
    const message = {
      id: "msg-secret", author: player, speaker: { actor: source.id }, rolls: [roll],
      flags: { pf2e: { context: { options: new Set(["action:sneak"]) } } }
    };
    const docs = new Map([[source.uuid, source], [target.uuid, target], [token.uuid, token]]);
    const messages = new Map([[message.id, message]]);
    const created = [];

    globalThis.CONFIG = { queries: {} };
    globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3, LIMITED: 1 } };
    globalThis.fromUuid = async (uuid) => docs.get(uuid) ?? null;
    globalThis.ChatMessage = {
      getSpeaker: () => ({ actor: source.id }),
      create: async (data) => { created.push(data); return { id: "summary-secret", ...data }; }
    };
    globalThis.game = {
      user: player, users, messages,
      i18n: { localize: (key) => key }
    };

    actionRegistry.clear();
    actionRegistry.registerMany(CORE_ACTIONS);
    const resolver = new SharedRollResolver();
    resolver.registerQueryHandler();
    gm.query = async (name, payload) => {
      const previous = globalThis.game.user;
      globalThis.game.user = gm;
      try { return await globalThis.CONFIG.queries[name](payload); }
      finally { globalThis.game.user = previous; }
    };

    const result = await resolver.request({
      definition: actionRegistry.get("sneak"),
      sourceActor: source,
      targets: [{ actorUuid: target.uuid, tokenUuid: token.uuid, source: "canvas" }],
      roll,
      rollMessageId: message.id
    });

    assert.equal(result.ok, true);
    assert.equal(result.hidden, true);
    assert.deepEqual(result.results, [], "player receives no secret per-target outcome payload");
    assert.deepEqual(created[0].whisper, [gm.id]);
    assert.equal(created[0].blind, true);
    assert.match(created[0].content, /23/, "GM-only summary may include the target DC");
  } finally {
    actionRegistry.clear();
    globalThis.game = oldGame;
    globalThis.CONFIG = oldConfig;
    globalThis.CONST = oldConst;
    globalThis.fromUuid = oldFromUuid;
    globalThis.ChatMessage = oldChatMessage;
  }
});
