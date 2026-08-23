import assert from "node:assert/strict";
import { test } from "node:test";

function valuesCollection(values) {
  const map = new Map(values.map((value) => [value.id ?? value.uuid, value]));
  map.party = null;
  return map;
}

function creature(id, { type = "character", ownerIds = [], limitedIds = [], items = [] } = {}) {
  return {
    id,
    uuid: `Actor.${id}`,
    name: id.toUpperCase(),
    img: `${id}.webp`,
    type,
    items,
    isOfType: (kind) => kind === "creature" || kind === type,
    testUserPermission: (user, level) => level >= 3 ? ownerIds.includes(user.id) : ownerIds.includes(user.id) || limitedIds.includes(user.id)
  };
}

test("GM target directory exposes party and assigned PCs without ownership but not hidden unrelated Actors", async () => {
  const oldGame = globalThis.game;
  const oldConst = globalThis.CONST;
  const oldCanvas = globalThis.canvas;
  const oldFromUuid = globalThis.fromUuid;
  try {
    globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { LIMITED: 1, OWNER: 3 } };
    const player = { id: "p1", isGM: false, active: true, viewedScene: "scene1" };
    const other = { id: "p2", isGM: false, active: true, viewedScene: "scene1" };
    const gm = { id: "gm", isGM: true, active: true };

    const own = creature("own", { ownerIds: ["p1"] });
    const companion = creature("companion", { type: "npc", ownerIds: ["p1"] });
    const partyMate = creature("party-mate");
    const assigned = creature("assigned");
    const sceneNpc = creature("scene-npc");
    const visibleNpc = creature("visible-npc", { limitedIds: ["p1"] });
    const secretNpc = creature("secret-npc");
    player.character = own;
    other.character = assigned;

    const actors = valuesCollection([own, companion, partyMate, assigned, sceneNpc, visibleNpc, secretNpc]);
    actors.party = { members: [own, partyMate] };
    const users = valuesCollection([player, other, gm]);
    const scene = { id: "scene1", tokens: valuesCollection([{ id: "t1", hidden: false, actor: sceneNpc }]) };
    const scenes = valuesCollection([scene]);

    globalThis.game = {
      user: gm,
      users,
      actors,
      scenes,
      time: { worldTime: 100 },
      i18n: { lang: "de", localize: (key) => key }
    };
    globalThis.canvas = { scene };
    globalThis.fromUuid = async (uuid) => actors.get(uuid.replace("Actor.", "")) ?? null;

    const { actionRegistry } = await import("../scripts/core/action-registry.js");
    if (!actionRegistry.get("target-picker-test")) {
      actionRegistry.register({
        id: "target-picker-test",
        label: "Target Picker Test",
        category: "general",
        categoryLabel: "General",
        target: { mode: "single", type: "creature", required: true },
        dc: { strategy: "fixed", value: 15 },
        execution: { enabled: true },
        visibility: { announcement: "public", roll: "public", outcome: "public" }
      });
    }

    const { TargetPickerService } = await import(`../scripts/core/target-picker-service.js?groups=${Date.now()}`);
    const service = new TargetPickerService();
    const groups = await service.buildGroups(player, { actionId: "target-picker-test", sourceActorUuid: own.uuid });
    const groupMap = new Map(groups.map((g) => [g.id, g.targets]));

    assert.deepEqual(new Set(groupMap.get("owned").map((t) => t.actorUuid)), new Set([own.uuid, companion.uuid]));
    assert.deepEqual(groupMap.get("party").map((t) => t.actorUuid), [partyMate.uuid]);
    assert.deepEqual(groupMap.get("characters").map((t) => t.actorUuid), [assigned.uuid]);
    assert.deepEqual(groupMap.get("scene").map((t) => t.actorUuid), [sceneNpc.uuid]);
    assert.deepEqual(groupMap.get("visible").map((t) => t.actorUuid), [visibleNpc.uuid]);
    assert.equal(groups.flatMap((g) => g.targets).some((t) => t.actorUuid === secretNpc.uuid), false);

    assert.equal(service.isEligibleTarget(partyMate, player), true, "party membership is enough even without ownership");
    assert.equal(service.isEligibleTarget(assigned, player), true, "another user's assigned PC is a safe target");
    assert.equal(service.isEligibleTarget(secretNpc, player), false, "unrelated hidden NPCs remain undisclosed and invalid");
  } finally {
    globalThis.game = oldGame;
    globalThis.CONST = oldConst;
    globalThis.canvas = oldCanvas;
    globalThis.fromUuid = oldFromUuid;
  }
});

test("picker-selected targets can exist without a locally readable Actor document", async () => {
  const oldGame = globalThis.game;
  const oldFromUuidSync = globalThis.fromUuidSync;
  try {
    globalThis.game = { user: { targets: new Set() } };
    globalThis.fromUuidSync = () => null;
    const { TargetResolver } = await import(`../scripts/core/target-resolver.js?picker-target=${Date.now()}`);
    const resolver = new TargetResolver();
    const action = { id: "treat-wounds", target: { mode: "single", required: true } };
    resolver.activate(action);

    const result = await resolver.addFromPickerEntry({
      actorUuid: "Actor.other-player",
      name: "Other Player",
      img: "other.webp",
      category: "party"
    }, action);
    assert.equal(result.ok, true);

    const state = resolver.getState(action);
    assert.equal(state.valid, true);
    assert.equal(state.targets[0].source, "picker");
    assert.equal(state.targets[0].actor, null);
    assert.equal(state.targets[0].actorUuid, "Actor.other-player");
    assert.equal(state.targets[0].name, "Other Player");
    assert.equal(state.targets[0].remote, true);
  } finally {
    globalThis.game = oldGame;
    globalThis.fromUuidSync = oldFromUuidSync;
  }
});

test("target picker UI and localization are wired into the Action Forge workspace", async () => {
  const fs = await import("node:fs/promises");
  const template = await fs.readFile(new URL("../templates/action-forge.hbs", import.meta.url), "utf8");
  const app = await fs.readFile(new URL("../scripts/ui/action-forge-app.js", import.meta.url), "utf8");
  assert.match(template, /data-action="pickTarget"/);
  assert.match(app, /targetPickerService\.choose/);
  assert.match(app, /targetEntry\?\.actorUuid && applicationEngine\.hasApplications/);
});

test("player target picker request resolves safe local targets without waiting for GM socket", async () => {
  const oldGame = globalThis.game;
  const oldConst = globalThis.CONST;
  const oldFoundry = globalThis.foundry;
  try {
    globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { LIMITED: 1, OWNER: 3 } };
    globalThis.foundry = { applications: { api: { DialogV2: { input: async () => ({ target: "Actor.mate" }) } } }, utils: { randomID: () => "local-request" } };
    const player = { id: "p1", isGM: false, active: true };
    const mate = creature("mate");
    const own = creature("own", { ownerIds: ["p1"] });
    player.character = own;
    const other = { id: "p2", isGM: false, active: true, character: mate };
    const gm = { id: "gm", isGM: true, active: true };
    const actors = valuesCollection([own, mate]);
    actors.party = { members: [own, mate] };
    let emits = 0;
    globalThis.game = {
      user: player,
      users: valuesCollection([player, other, gm]),
      actors,
      scenes: valuesCollection([]),
      socket: { emit: () => { emits += 1; } },
      time: { worldTime: 0 },
      i18n: { lang: "de", localize: (key) => key }
    };

    const { TargetPickerService } = await import(`../scripts/core/target-picker-service.js?local-first=${Date.now()}`);
    const service = new TargetPickerService();
    const result = await service.request({ actionId: "target-picker-test", sourceActorUuid: own.uuid });
    assert.equal(result.ok, true);
    assert.equal(result.source, "local");
    assert.equal(result.groups.flatMap((g) => g.targets).some((t) => t.actorUuid === mate.uuid), true);
    assert.equal(emits, 0, "safe local targets must not trigger a GM socket request");
  } finally {
    globalThis.game = oldGame;
    globalThis.CONST = oldConst;
    globalThis.foundry = oldFoundry;
  }
});

test("GM target directory socket failures return an explicit response instead of timing out", async () => {
  const oldGame = globalThis.game;
  try {
    const gm = { id: "gm", isGM: true, active: true };
    const player = { id: "p1", isGM: false, active: true };
    let listener = null;
    const emitted = [];
    globalThis.game = {
      user: gm,
      users: valuesCollection([gm, player]),
      actors: valuesCollection([]),
      socket: {
        on: (_channel, fn) => { listener = fn; },
        emit: (_channel, payload) => emitted.push(payload)
      }
    };

    const { TargetPickerService } = await import(`../scripts/core/target-picker-service.js?socket-failure=${Date.now()}`);
    const service = new TargetPickerService();
    service.buildGroups = async () => { throw new Error("synthetic test failure"); };
    service.initialize();
    assert.equal(typeof listener, "function");
    const oldError = console.error;
    console.error = () => {};
    try {
      await listener({
        type: "target-list-request",
        requestId: "r1",
        brokerId: "gm",
        allowAnyBroker: true,
        requesterId: "p1",
        actionId: "treat-wounds"
      });
    } finally {
      console.error = oldError;
    }
    const response = emitted.find((payload) => payload.type === "target-list-response");
    assert.ok(response);
    assert.equal(response.requestId, "r1");
    assert.equal(response.result.ok, false);
    assert.equal(response.result.reason, "gm-directory-error");
  } finally {
    globalThis.game = oldGame;
  }
});
