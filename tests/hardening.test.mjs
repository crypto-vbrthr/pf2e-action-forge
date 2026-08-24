import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

function usersCollection(values, activeGM = null) {
  const list = [...values];
  list.get = (id) => list.find((entry) => entry?.id === id) ?? null;
  list.activeGM = activeGM;
  return list;
}

test("dev.9 filters hidden canvas targets from non-GM target resolution", async () => {
  const oldGame = globalThis.game;
  try {
    const actor = (id) => ({
      id,
      uuid: `Actor.${id}`,
      name: id,
      type: "npc",
      isOfType: (kind) => kind === "creature" || kind === "npc"
    });
    const hidden = { actor: actor("hidden"), document: { uuid: "Scene.s.Token.hidden", hidden: true, texture: {} } };
    const visible = { actor: actor("visible"), document: { uuid: "Scene.s.Token.visible", hidden: false, texture: {} } };
    globalThis.game = { user: { id: "p1", isGM: false, targets: new Set([hidden, visible]) } };

    const { TargetResolver } = await import(`../scripts/core/target-resolver.js?hidden-target=${Date.now()}`);
    const resolver = new TargetResolver();
    const state = resolver.getState({ id: "test", target: { mode: "multiple", required: false } });
    assert.equal(state.targets.length, 1);
    assert.equal(state.targets[0].actorUuid, "Actor.visible");
  } finally {
    globalThis.game = oldGame;
  }
});

test("Application Broker rejects a stale or deleted canvas token instead of trusting its Actor UUID", async () => {
  const oldGame = globalThis.game;
  const oldConst = globalThis.CONST;
  const oldFromUuid = globalThis.fromUuid;
  const oldFromUuidSync = globalThis.fromUuidSync;
  try {
    globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { LIMITED: 1, OWNER: 3 } };
    const player = { id: "hardening-player", isGM: false, active: true };
    const source = {
      uuid: "Actor.hardening-source",
      name: "Source",
      type: "character",
      documentName: "Actor",
      testUserPermission: (user, level) => user.id === player.id && level >= 3
    };
    let writes = 0;
    const target = {
      uuid: "Actor.hardening-target",
      name: "Target",
      type: "character",
      documentName: "Actor",
      visible: true,
      testUserPermission: (user, level) => user.id === player.id && level >= 3,
      conditions: { hasType: () => false },
      isImmuneTo: () => false,
      createEmbeddedDocuments: async () => { writes += 1; return [{ id: "x" }]; }
    };
    const transaction = {
      id: "hardening-stale-token-tx",
      actionId: "hardening-stale-token-action",
      sourceActorUuid: source.uuid,
      targetActorUuid: target.uuid,
      targetActorName: target.name,
      targetTokenUuid: "Scene.deleted.Token.gone",
      targetSource: "canvas",
      outcome: "success",
      createdBy: player.id
    };
    const message = {
      id: "hardening-message",
      flags: { "pf2e-action-forge": { application: { transaction, applied: {} } } },
      update: async () => {}
    };
    const users = usersCollection([player]);
    globalThis.game = {
      user: player,
      users,
      messages: { get: (id) => id === message.id ? message : null },
      pf2e: {
        ConditionManager: {
          getCondition: (slug) => ({ slug, toObject: () => ({ type: "condition", system: {}, flags: {} }) })
        }
      }
    };
    globalThis.fromUuid = async (uuid) => uuid === source.uuid ? source : uuid === target.uuid ? target : null;
    globalThis.fromUuidSync = () => null;

    const canonical = await import("../scripts/core/action-registry.js");
    if (!canonical.actionRegistry.has("hardening-stale-token-action")) {
      canonical.actionRegistry.register({
        id: "hardening-stale-token-action",
        label: "Hardening",
        category: "general",
        categoryLabel: "General",
        target: { mode: "single", type: "creature" },
        dc: { strategy: "manual" },
        execution: { enabled: true },
        visibility: { announcement: "public", roll: "public", outcome: "public" },
        application: { outcomes: { success: [{ id: "prone", type: "condition-add", condition: "prone", target: "target" }] } }
      });
    }

    const { ApplicationBroker } = await import(`../scripts/core/application-broker.js?stale-token=${Date.now()}`);
    const broker = new ApplicationBroker();
    const result = await broker.request({ messageId: message.id, transactionId: transaction.id, effectId: "prone" });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "invalid-target");
    assert.equal(writes, 0);
  } finally {
    globalThis.game = oldGame;
    globalThis.CONST = oldConst;
    globalThis.fromUuid = oldFromUuid;
    globalThis.fromUuidSync = oldFromUuidSync;
  }
});

test("Application Broker fails over from a disconnected active GM without falling back to a timeout socket", async () => {
  const oldGame = globalThis.game;
  try {
    const player = { id: "p1", isGM: false, active: true };
    let firstCalls = 0;
    let secondCalls = 0;
    const gm1 = { id: "gm-a", isGM: true, active: true, query: async () => { firstCalls += 1; throw new Error("gone"); } };
    const gm2 = { id: "gm-b", isGM: true, active: true, query: async () => { secondCalls += 1; return { ok: true, via: "gm-b" }; } };
    const users = usersCollection([player, gm1, gm2], gm1);
    globalThis.game = { user: player, users, messages: { get: () => null } };

    const oldWarn = console.warn;
    console.warn = () => {};
    try {
      const { ApplicationBroker } = await import(`../scripts/core/application-broker.js?failover=${Date.now()}`);
      const result = await new ApplicationBroker().request({ messageId: "m", transactionId: "t", effectId: "e" });
      assert.equal(result.ok, true);
      assert.equal(result.via, "gm-b");
      assert.equal(firstCalls, 1);
      assert.equal(secondCalls, 1);
    } finally {
      console.warn = oldWarn;
    }
  } finally {
    globalThis.game = oldGame;
  }
});

test("Target Picker registers a prefixed Foundry query handler and returns only its sanitized group result", async () => {
  const oldGame = globalThis.game;
  const oldConfig = globalThis.CONFIG;
  try {
    const gm = { id: "gm", isGM: true, active: true };
    const player = { id: "p", isGM: false, active: true };
    globalThis.CONFIG = { queries: {} };
    globalThis.game = { user: gm, users: usersCollection([gm, player]) };
    const { TargetPickerService } = await import(`../scripts/core/target-picker-service.js?query-handler=${Date.now()}`);
    const service = new TargetPickerService();
    service.buildGroups = async () => [{ id: "party", targets: [{ actorUuid: "Actor.safe", name: "Safe" }] }];
    service.registerQueryHandler();
    const handler = globalThis.CONFIG.queries["pf2e-action-forge.targetDirectory"];
    assert.equal(typeof handler, "function");
    const result = await handler({ requesterId: player.id, actionId: "treat-wounds", sourceActorUuid: "Actor.source" });
    assert.equal(result.ok, true);
    assert.equal(result.source, "gm-query");
    assert.deepEqual(result.groups[0].targets.map((entry) => Object.keys(entry).sort()), [["actorUuid", "name"]]);
  } finally {
    globalThis.game = oldGame;
    globalThis.CONFIG = oldConfig;
  }
});

test("Target Picker query fallback chooses one active GM at a time and can fail over", async () => {
  const oldGame = globalThis.game;
  const oldConst = globalThis.CONST;
  const oldCanvas = globalThis.canvas;
  try {
    globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { LIMITED: 1, OWNER: 3 } };
    globalThis.canvas = { scene: null };
    const player = { id: "p", isGM: false, active: true, viewedScene: null };
    let a = 0;
    let b = 0;
    const gm1 = { id: "gm1", isGM: true, active: true, query: async () => { a += 1; throw new Error("disconnect"); } };
    const gm2 = { id: "gm2", isGM: true, active: true, query: async () => { b += 1; return { ok: true, source: "gm-query", groups: [{ id: "party", targets: [{ actorUuid: "Actor.pc", name: "PC" }] }] }; } };
    const users = usersCollection([player, gm1, gm2], gm1);
    const actors = [];
    actors.party = { members: [] };
    globalThis.game = {
      user: player,
      users,
      actors,
      scenes: { get: () => null },
      time: { worldTime: 0 }
    };
    const oldWarn = console.warn;
    console.warn = () => {};
    try {
      const { TargetPickerService } = await import(`../scripts/core/target-picker-service.js?query-failover=${Date.now()}`);
      const result = await new TargetPickerService().request({ actionId: "treat-wounds", sourceActorUuid: "Actor.source" });
      assert.equal(result.ok, true);
      assert.equal(result.groups[0].targets[0].actorUuid, "Actor.pc");
      assert.equal(a, 1);
      assert.equal(b, 1);
    } finally {
      console.warn = oldWarn;
    }
  } finally {
    globalThis.game = oldGame;
    globalThis.CONST = oldConst;
    globalThis.canvas = oldCanvas;
  }
});

test("GM DC Handoff uses bounded registered User.query failover when chat and socket transport are unavailable", async () => {
  const oldGame = globalThis.game;
  const oldFoundry = globalThis.foundry;
  const oldChatMessage = globalThis.ChatMessage;
  try {
    const player = { id: "player", isGM: false, active: true };
    const calls = [];
    const gm1 = {
      id: "gm1", isGM: true, active: true,
      query: async (_name, _payload, options) => {
        calls.push(["gm1", options?.timeout]);
        throw new Error("disconnect");
      }
    };
    const gm2 = {
      id: "gm2", isGM: true, active: true,
      query: async (_name, _payload, options) => {
        calls.push(["gm2", options?.timeout]);
        return { ok: true, dc: 25, gmId: "gm2" };
      }
    };
    const users = usersCollection([gm2, gm1, player], gm1);
    globalThis.ChatMessage = undefined;
    globalThis.game = { user: player, users, i18n: { localize: (key) => key, format: (_key, data) => JSON.stringify(data) }, socket: null };
    globalThis.foundry = { utils: { escapeHTML: String }, applications: { api: { DialogV2: { input: async () => ({ dc: 25 }) } } } };
    const oldWarn = console.warn;
    console.warn = () => {};
    try {
      const { GmDcHandoff } = await import(`../scripts/core/gm-dc-handoff.js?dev18-4-query-fallback=${Date.now()}`);
      const result = await new GmDcHandoff().request({ definition: { id: "x", label: "X" }, actor: { name: "A" }, requestId: "r" });
      assert.equal(result.ok, true);
      assert.equal(result.gmId, "gm2");
      assert.deepEqual(calls, [["gm1", 8000], ["gm2", 8000]]);
    } finally {
      console.warn = oldWarn;
    }
  } finally {
    globalThis.game = oldGame;
    globalThis.foundry = oldFoundry;
    globalThis.ChatMessage = oldChatMessage;
  }
});

test("Visibility hardening prevents player-facing application cards from exposing GM-only outcomes", async () => {
  const oldGame = globalThis.game;
  try {
    globalThis.game = { user: { id: "p", isGM: false } };
    const { VisibilityEngine } = await import(`../scripts/core/visibility-engine.js?outcome-hardening=${Date.now()}`);
    const engine = new VisibilityEngine();
    assert.equal(engine.canExposeOutcome({ visibility: { outcome: "gm" } }, globalThis.game.user), false);
    assert.equal(engine.canExposeOutcome({ visibility: { outcome: "blind" } }, globalThis.game.user), false);
    assert.equal(engine.canExposeOutcome({ visibility: { outcome: "public" } }, globalThis.game.user), true);
    assert.equal(engine.canExposeOutcome({ visibility: { outcome: "gm" } }, { isGM: true }), true);
  } finally {
    globalThis.game = oldGame;
  }
});

test("Action Forge dev.9 locks duplicate execution, cleans up completed sessions, and preserves scroll/focus across rerenders", async () => {
  const app = await readFile(new URL("scripts/ui/action-forge-app.js", root), "utf8");
  const template = await readFile(new URL("templates/action-forge.hbs", root), "utf8");
  assert.match(app, /executionInFlight = true;[\s\S]*await pf2eActionAdapter\.execute/);
  assert.match(app, /finally \{[\s\S]*executionInFlight = false;[\s\S]*unlockActionActor/);
  assert.match(app, /pendingGmDcRequest \|\| app\?\.executionInFlight/);
  assert.match(app, /#captureUiState\(\)[\s\S]*scrollTop/);
  assert.match(app, /#restoreUiStateAfterRender\(\)/);
  assert.match(app, /visibilityEngine\.canExposeOutcome/);
  assert.match(template, /aria-busy="true"/);
  assert.match(template, /#if executionInFlight/);
});

test("Chat application controls coalesce duplicate rendered-button requests", async () => {
  const source = await readFile(new URL("scripts/core/application-chat.js", root), "utf8");
  assert.match(source, /#pendingApplications = new Map\(\)/);
  assert.match(source, /this\.#pendingApplications\.get\(requestKey\)/);
  assert.match(source, /this\.#pendingApplications\.set\(requestKey, request\)/);
  assert.match(source, /if \(owner\) this\.#pendingApplications\.delete\(requestKey\)/);
});
