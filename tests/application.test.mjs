import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";

const moduleJson = JSON.parse(fs.readFileSync(new URL("../module.json", import.meta.url), "utf8"));

test("dev.6 Grapple and Trip applications remain available in dev.7", async () => {
  const { CORE_ACTIONS } = await import(`../scripts/data/core-action-catalog.js?apps=${Date.now()}`);
  const grapple = CORE_ACTIONS.find((a) => a.id === "grapple");
  const trip = CORE_ACTIONS.find((a) => a.id === "trip");

  assert.equal(grapple.execution.enabled, true);
  assert.equal(grapple.application.outcomes.success[0].condition, "grabbed");
  assert.equal(grapple.application.outcomes.criticalSuccess[0].condition, "restrained");
  assert.equal(trip.execution.enabled, true);
  assert.equal(trip.application.outcomes.success[0].condition, "prone");
  assert.equal(trip.application.outcomes.criticalSuccess[0].condition, "prone");
});

test("Application Engine applies only allow-listed declarative condition effects", async () => {
  const oldGame = globalThis.game;
  try {
    globalThis.game = {
      pf2e: {
        ConditionManager: {
          getCondition: (slug) => ({
            slug,
            toObject: () => ({ _id: "template", name: slug, type: "condition", system: {}, flags: { pf2e: {} } })
          })
        }
      }
    };

    const { ApplicationEngine } = await import(`../scripts/core/application-engine.js?engine=${Date.now()}`);
    const engine = new ApplicationEngine();
    const created = [];
    const targetActor = {
      uuid: "Actor.target",
      conditions: { hasType: () => false },
      isImmuneTo: () => false,
      createEmbeddedDocuments: async (_type, sources) => {
        created.push(...sources);
        return [{ id: "condition-1" }];
      }
    };
    const sourceActor = { uuid: "Actor.source" };
    const effect = { id: "grabbed", type: "condition-add", condition: "grabbed" };
    const result = await engine.apply({ effect, targetActor, sourceActor, transactionId: "tx1" });

    assert.equal(result.ok, true);
    assert.equal(created.length, 1);
    assert.equal(created[0]._id, undefined);
    assert.equal(created[0].flags["pf2e-action-forge"].transactionId, "tx1");
    assert.equal(created[0].flags["pf2e-action-forge"].sourceActorUuid, "Actor.source");

    const unsafe = await engine.apply({ effect: { id: "x", type: "actor-update" }, targetActor });
    assert.equal(unsafe.ok, false);
    assert.equal(unsafe.reason, "unsupported-effect");
  } finally {
    globalThis.game = oldGame;
  }
});

test("Application Broker applies a validated result once and records idempotence", async () => {
  const oldGame = globalThis.game;
  const oldConst = globalThis.CONST;
  const oldFromUuid = globalThis.fromUuid;
  try {
    globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { LIMITED: 1, OWNER: 3 } };
    const gm = { id: "gm1", isGM: true, active: true };
    const sourceActor = { uuid: "Actor.source", name: "Source", documentName: "Actor" };
    let hasCondition = false;
    let creates = 0;
    const targetActor = {
      uuid: "Actor.target",
      name: "Target",
      documentName: "Actor",
      visible: true,
      conditions: { hasType: () => hasCondition },
      isImmuneTo: () => false,
      createEmbeddedDocuments: async () => {
        hasCondition = true;
        creates += 1;
        return [{ id: "c1" }];
      }
    };
    const flag = {
      transaction: {
        id: "tx-broker",
        actionId: "broker-test-action",
        sourceActorUuid: sourceActor.uuid,
        targetActorUuid: targetActor.uuid,
        targetActorName: "Target",
        targetSource: "sidebar",
        outcome: "success",
        createdBy: gm.id
      },
      applied: {}
    };
    const message = {
      id: "msg1",
      flags: { "pf2e-action-forge": { application: flag } },
      update: async (changes) => {
        const applied = changes["flags.pf2e-action-forge.application.applied"];
        if (applied) flag.applied = applied;
      }
    };
    const users = [gm];
    users.get = (id) => users.find((u) => u.id === id);
    globalThis.game = {
      user: gm,
      users,
      messages: { get: (id) => id === "msg1" ? message : null },
      pf2e: {
        ConditionManager: {
          getCondition: (slug) => ({ slug, toObject: () => ({ type: "condition", system: {}, flags: {} }) })
        }
      }
    };
    globalThis.fromUuid = async (uuid) => uuid === sourceActor.uuid ? sourceActor : uuid === targetActor.uuid ? targetActor : null;

    const { actionRegistry } = await import(`../scripts/core/action-registry.js?broker-reg=${Date.now()}`);
    // ApplicationBroker has its own import of the non-query registry module; use that canonical instance too.
    const canonical = await import("../scripts/core/action-registry.js");
    canonical.actionRegistry.register({
      id: "broker-test-action",
      label: "Test",
      category: "general",
      categoryLabel: "General",
      target: { mode: "single", type: "creature" },
      dc: { strategy: "manual" },
      execution: { enabled: true },
      visibility: { announcement: "public", roll: "public", outcome: "public" },
      application: { outcomes: { success: [{ id: "prone", type: "condition-add", condition: "prone", target: "target" }] } }
    });

    const { ApplicationBroker } = await import(`../scripts/core/application-broker.js?broker=${Date.now()}`);
    const broker = new ApplicationBroker();
    const first = await broker.request({ messageId: "msg1", transactionId: "tx-broker", effectId: "prone" });
    assert.equal(first.ok, true);
    assert.equal(creates, 1);
    assert.ok(flag.applied.prone);

    const second = await broker.request({ messageId: "msg1", transactionId: "tx-broker", effectId: "prone" });
    assert.equal(second.ok, true);
    assert.equal(second.alreadyApplied, true);
    assert.equal(creates, 1);
  } finally {
    globalThis.game = oldGame;
    globalThis.CONST = oldConst;
    globalThis.fromUuid = oldFromUuid;
  }
});

test("module manifest enables module sockets for GM-mediated applications", () => {
  assert.equal(moduleJson.socket, true);
  assert.equal(moduleJson.version, "0.1.0-dev.7.6");
  assert.match(moduleJson.download, /v0\.1\.0-dev\.7/);
});

test("picker-selected party targets validate when PF2e party members is a Set-like collection", async () => {
  const oldGame = globalThis.game;
  const oldConst = globalThis.CONST;
  const oldCanvas = globalThis.canvas;
  try {
    globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { LIMITED: 1, OWNER: 3 } };
    const player = { id: "p1", isGM: false, active: true };
    const sourceActor = {
      uuid: "Actor.source",
      type: "character",
      isOfType: (kind) => kind === "creature" || kind === "character",
      testUserPermission: (user, level) => user.id === "p1" && level >= 3
    };
    const targetActor = {
      uuid: "Actor.target",
      type: "character",
      visible: true,
      isOfType: (kind) => kind === "creature" || kind === "character",
      testUserPermission: () => false
    };
    const members = new Set([sourceActor, targetActor]);
    const actors = [];
    actors.party = { members };
    globalThis.game = {
      user: player,
      users: [],
      actors,
      scenes: { get: () => null }
    };
    globalThis.canvas = { scene: null };

    const { TargetPickerService } = await import(`../scripts/core/target-picker-service.js?set-members=${Date.now()}`);
    const service = new TargetPickerService();
    assert.equal(service.isEligibleTarget(targetActor, player), true);
  } finally {
    globalThis.game = oldGame;
    globalThis.CONST = oldConst;
    globalThis.canvas = oldCanvas;
  }
});

test("GM application socket returns broker-error instead of timing out when processing throws", async () => {
  const oldGame = globalThis.game;
  try {
    const gm = { id: "gm", isGM: true, active: true };
    let listener = null;
    const emitted = [];
    const users = [gm];
    users.get = (id) => users.find((u) => u.id === id);
    globalThis.game = {
      user: gm,
      users,
      socket: {
        on: (_channel, fn) => { listener = fn; },
        emit: (_channel, payload) => emitted.push(payload)
      },
      messages: { get: () => { throw new Error("synthetic broker failure"); } }
    };

    const { ApplicationBroker } = await import(`../scripts/core/application-broker.js?socket-error=${Date.now()}`);
    const broker = new ApplicationBroker();
    broker.initialize();
    assert.equal(typeof listener, "function");
    const oldError = console.error;
    console.error = () => {};
    try {
      await listener({
        type: "apply-request",
        requestId: "req-1",
        brokerId: "gm",
        requesterId: "gm",
        payload: { messageId: "m1", transactionId: "t1", effectId: "e1" }
      });
    } finally {
      console.error = oldError;
    }
    const response = emitted.find((payload) => payload.type === "apply-response");
    assert.ok(response);
    assert.equal(response.result.ok, false);
    assert.equal(response.result.reason, "broker-error");
  } finally {
    globalThis.game = oldGame;
  }
});


test("Application Broker registers a Foundry v14 prefixed User query handler", async () => {
  const oldConfig = globalThis.CONFIG;
  const oldGame = globalThis.game;
  try {
    globalThis.CONFIG = { queries: {} };
    globalThis.game = { user: { id: "gm", isGM: true, active: true } };
    const { ApplicationBroker } = await import(`../scripts/core/application-broker.js?query-register=${Date.now()}`);
    const broker = new ApplicationBroker();
    broker.registerQueryHandler();
    assert.equal(typeof globalThis.CONFIG.queries["pf2e-action-forge.applyActionResult"], "function");
  } finally {
    globalThis.CONFIG = oldConfig;
    globalThis.game = oldGame;
  }
});

test("player application uses Foundry User.query instead of waiting for raw socket response", async () => {
  const oldGame = globalThis.game;
  const oldConst = globalThis.CONST;
  const oldFromUuid = globalThis.fromUuid;
  try {
    globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3 } };
    const player = { id: "p1", isGM: false, active: true };
    let observed = null;
    const gm = {
      id: "gm1",
      isGM: true,
      active: true,
      query: async (name, data, options) => {
        observed = { name, data, options };
        return { ok: false, reason: "synthetic-query-response" };
      }
    };
    const users = [player, gm];
    users.get = (id) => users.find((u) => u.id === id);
    users.activeGM = gm;
    globalThis.game = {
      user: player,
      users,
      messages: { get: () => null },
      socket: { emit: () => { throw new Error("raw socket must not be used when User.query exists"); } }
    };
    globalThis.fromUuid = async () => null;

    const { ApplicationBroker } = await import(`../scripts/core/application-broker.js?query-request=${Date.now()}`);
    const broker = new ApplicationBroker();
    const result = await broker.request({ messageId: "m1", transactionId: "t1", effectId: "heal" });
    assert.equal(result.reason, "synthetic-query-response");
    assert.equal(observed.name, "pf2e-action-forge.applyActionResult");
    assert.equal(observed.data.requesterId, "p1");
    assert.equal(observed.data.payload.messageId, "m1");
    assert.equal(observed.options.timeout, 10000);
  } finally {
    globalThis.game = oldGame;
    globalThis.CONST = oldConst;
    globalThis.fromUuid = oldFromUuid;
  }
});
