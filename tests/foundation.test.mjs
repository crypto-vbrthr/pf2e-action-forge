import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));

test("manifest identifies the development build and Foundry/PF2e compatibility", async () => {
  const manifest = await readJson("module.json");
  assert.equal(manifest.id, "pf2e-action-forge");
  assert.equal(manifest.version, "0.1.0-dev.6");
  assert.equal(manifest.url, "https://github.com/crypto-vbrthr/pf2e-action-forge");
  assert.equal(manifest.manifest, "https://github.com/crypto-vbrthr/pf2e-action-forge/releases/latest/download/module.json");
  assert.equal(manifest.download, "https://github.com/crypto-vbrthr/pf2e-action-forge/releases/download/v0.1.0-dev.6/pf2e-action-forge.zip");
  assert.equal(manifest.compatibility.minimum, "14");
  assert.equal(manifest.compatibility.verified, "14");
  assert.equal(manifest.relationships.systems[0].id, "pf2e");
  assert.equal(manifest.relationships.systems[0].compatibility.minimum, "8.4.0");
});

test("English and German localization expose the same keys", async () => {
  const en = await readJson("lang/en.json");
  const de = await readJson("lang/de.json");
  assert.deepEqual(Object.keys(de).sort(), Object.keys(en).sort());
});

test("manifest files referenced by the build exist", async () => {
  const manifest = await readJson("module.json");
  const referenced = [
    ...manifest.esmodules,
    ...manifest.styles,
    ...manifest.languages.map((entry) => entry.path)
  ];

  for (const relativePath of referenced) {
    const data = await readFile(new URL(relativePath, root));
    assert.ok(data.length > 0, `${relativePath} should not be empty`);
  }
});



test("repository release files are present", async () => {
  const changelog = await readFile(new URL("CHANGELOG.md", root), "utf8");
  const license = await readFile(new URL("LICENSE", root), "utf8");
  assert.match(changelog, /0\.1\.0-dev\.5/);
  assert.match(license, /MIT License/);
});

test("the action registry rejects duplicates and preserves normalized definitions", async () => {
  const { ActionRegistry } = await import("../scripts/core/action-registry.js");
  const registry = new ActionRegistry();
  const action = registry.register({ id: " example ", label: "Example.Key" });
  assert.equal(action.id, "example");
  assert.equal(action.category, "general");
  assert.ok(Object.isFrozen(action));
  assert.throws(() => registry.register({ id: "example", label: "Example.Other" }), /Duplicate action id/);
});

test("Foundry v14 Token SceneControl receives an ordered Action Forge button", async () => {
  const { registerActionForgeSceneControl } = await import("../scripts/ui/scene-controls.js");
  let opened = 0;
  const controls = {
    tokens: {
      tools: {
        select: { name: "select", order: 0 },
        target: { name: "target", order: 4 }
      }
    }
  };

  assert.equal(registerActionForgeSceneControl(controls, () => opened++), true);
  const tool = controls.tokens.tools.actionForge;
  assert.ok(tool);
  assert.equal(tool.name, "actionForge");
  assert.equal(tool.order, 5);
  assert.equal(tool.button, true);
  assert.equal(tool.visible, true);
  assert.equal(typeof tool.onChange, "function");
  tool.onChange();
  assert.equal(opened, 1);
});

test("scene-control registration fails safely when Token controls are unavailable", async () => {
  const { registerActionForgeSceneControl } = await import("../scripts/ui/scene-controls.js");
  assert.equal(registerActionForgeSceneControl({}, () => {}), false);
});

test("actor resolver uses a controlled synthetic NPC actor that is absent from game.actors", async () => {
  const oldGame = globalThis.game;
  const oldCanvas = globalThis.canvas;
  const oldConst = globalThis.CONST;

  const pc = {
    uuid: "Actor.pc",
    name: "First PC",
    type: "character",
    isOfType: (type) => type === "creature"
  };
  const npc = {
    uuid: "Scene.scene.Token.npc.Actor.synthetic",
    name: "Unlinked NPC",
    type: "npc",
    isOfType: (type) => type === "creature"
  };

  try {
    globalThis.game = {
      actors: { contents: [pc] },
      user: { isGM: true, character: null },
      i18n: { lang: "en" }
    };
    globalThis.canvas = {
      tokens: { controlled: [{ actor: npc }] }
    };
    globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3 } };

    const { ActorResolver } = await import(`../scripts/core/actor-resolver.js?synthetic-npc=${Date.now()}`);
    const resolver = new ActorResolver();
    const context = resolver.getContext();

    assert.equal(context.actor, npc);
    assert.equal(context.source, "token");
    assert.equal(context.actors[0], npc);
    assert.ok(context.actors.includes(pc));
  } finally {
    globalThis.game = oldGame;
    globalThis.canvas = oldCanvas;
    globalThis.CONST = oldConst;
  }
});


test("actor resolver can switch between a pinned actor and current-token automatic mode", async () => {
  const oldGame = globalThis.game;
  const oldCanvas = globalThis.canvas;
  const oldConst = globalThis.CONST;

  const pc = {
    uuid: "Actor.pc",
    name: "Pinned PC",
    type: "character",
    isOfType: (type) => type === "creature"
  };
  const npc1 = {
    uuid: "Scene.scene.Token.npc1.Actor.synthetic",
    name: "NPC One",
    type: "npc",
    isOfType: (type) => type === "creature"
  };
  const npc2 = {
    uuid: "Scene.scene.Token.npc2.Actor.synthetic",
    name: "NPC Two",
    type: "npc",
    isOfType: (type) => type === "creature"
  };

  try {
    globalThis.game = {
      actors: { contents: [pc] },
      user: { isGM: true, character: null },
      i18n: { lang: "en" }
    };
    globalThis.canvas = { tokens: { controlled: [{ actor: npc1 }] } };
    globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3 } };

    const { ActorResolver, CURRENT_TOKEN_SELECTION } = await import(`../scripts/core/actor-resolver.js?selection-mode=${Date.now()}`);
    const resolver = new ActorResolver();

    assert.equal(resolver.followsCurrentToken, true);
    assert.equal(resolver.resolve(), npc1);

    resolver.setSelectedActor(pc.uuid);
    assert.equal(resolver.followsCurrentToken, false);
    assert.equal(resolver.resolve(), pc);

    globalThis.canvas.tokens.controlled = [{ actor: npc2 }];
    assert.equal(resolver.resolve(), pc, "explicit selection should remain pinned while active");

    resolver.setSelectedActor(CURRENT_TOKEN_SELECTION);
    assert.equal(resolver.followsCurrentToken, true);
    assert.equal(resolver.resolve(), npc2, "automatic mode should follow the newly controlled token");
  } finally {
    globalThis.game = oldGame;
    globalThis.canvas = oldCanvas;
    globalThis.CONST = oldConst;
  }
});

test("players can select owned companions and familiars belonging to an owned master", async () => {
  const oldGame = globalThis.game;
  const oldCanvas = globalThis.canvas;
  const oldConst = globalThis.CONST;

  const permission = (owned) => (_user, level) => owned && level === 3;
  const master = {
    id: "master",
    uuid: "Actor.master",
    name: "Hero",
    type: "character",
    isOfType: (type) => type === "creature",
    testUserPermission: permission(true)
  };
  const companion = {
    id: "companion",
    uuid: "Actor.companion",
    name: "Animal Companion",
    type: "character",
    isOfType: (type) => type === "creature",
    testUserPermission: permission(true)
  };
  const familiar = {
    id: "familiar",
    uuid: "Actor.familiar",
    name: "Familiar",
    type: "familiar",
    master,
    isOfType: (type) => type === "creature",
    testUserPermission: permission(false)
  };
  const unrelated = {
    id: "unrelated",
    uuid: "Actor.unrelated",
    name: "Secret NPC",
    type: "npc",
    isOfType: (type) => type === "creature",
    testUserPermission: permission(false)
  };

  try {
    const contents = [master, companion, familiar, unrelated];
    globalThis.game = {
      actors: {
        contents,
        get: (id) => contents.find((actor) => actor.id === id) ?? null
      },
      user: { isGM: false, character: master },
      i18n: { lang: "en" }
    };
    globalThis.canvas = { tokens: { controlled: [] } };
    globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3 } };

    const { ActorResolver } = await import(`../scripts/core/actor-resolver.js?companions=${Date.now()}`);
    const available = new ActorResolver().getAvailableActors();

    assert.ok(available.includes(master));
    assert.ok(available.includes(companion));
    assert.ok(available.includes(familiar));
    assert.ok(!available.includes(unrelated));
  } finally {
    globalThis.game = oldGame;
    globalThis.canvas = oldCanvas;
    globalThis.CONST = oldConst;
  }
});


test("actor resolver freezes the acting Actor for an action and resumes automatic token following after unlock", async () => {
  const oldGame = globalThis.game;
  const oldCanvas = globalThis.canvas;
  const oldConst = globalThis.CONST;

  const actorA = {
    uuid: "Scene.scene.Token.a.Actor.synthetic",
    name: "Actor A",
    type: "npc",
    isOfType: (type) => type === "creature"
  };
  const actorB = {
    uuid: "Scene.scene.Token.b.Actor.synthetic",
    name: "Actor B",
    type: "npc",
    isOfType: (type) => type === "creature"
  };

  try {
    globalThis.game = {
      actors: { contents: [] },
      user: { isGM: true, character: null },
      i18n: { lang: "en" }
    };
    globalThis.canvas = { tokens: { controlled: [{ actor: actorA }] } };
    globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3 } };

    const { ActorResolver } = await import(`../scripts/core/actor-resolver.js?action-lock=${Date.now()}`);
    const resolver = new ActorResolver();

    assert.equal(resolver.resolve(), actorA);
    assert.equal(resolver.lockActionActor(), actorA);
    assert.equal(resolver.isActionLocked, true);

    globalThis.canvas.tokens.controlled = [{ actor: actorB }];
    assert.equal(resolver.resolve(), actorA, "target/control changes must not replace the acting Actor mid-action");
    assert.equal(resolver.getContext().actionLocked, true);

    resolver.unlockActionActor();
    assert.equal(resolver.isActionLocked, false);
    assert.equal(resolver.resolve(), actorB, "automatic mode should resume the currently controlled token after the action ends");
  } finally {
    globalThis.game = oldGame;
    globalThis.canvas = oldCanvas;
    globalThis.CONST = oldConst;
  }
});

test("action lock does not erase an explicitly pinned Actor selection", async () => {
  const oldGame = globalThis.game;
  const oldCanvas = globalThis.canvas;
  const oldConst = globalThis.CONST;

  const pinned = { uuid: "Actor.pinned", name: "Pinned", type: "character", isOfType: (t) => t === "creature" };
  const tokenActor = { uuid: "Actor.token", name: "Token", type: "character", isOfType: (t) => t === "creature" };

  try {
    globalThis.game = { actors: { contents: [pinned, tokenActor] }, user: { isGM: true, character: null }, i18n: { lang: "en" } };
    globalThis.canvas = { tokens: { controlled: [{ actor: tokenActor }] } };
    globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3 } };

    const { ActorResolver } = await import(`../scripts/core/actor-resolver.js?action-pin=${Date.now()}`);
    const resolver = new ActorResolver();
    resolver.setSelectedActor(pinned.uuid);
    assert.equal(resolver.resolve(), pinned);
    resolver.lockActionActor();
    resolver.unlockActionActor();
    assert.equal(resolver.resolve(), pinned, "explicit source selection should survive an action session");
  } finally {
    globalThis.game = oldGame;
    globalThis.canvas = oldCanvas;
    globalThis.CONST = oldConst;
  }
});
