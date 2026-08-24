import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));

test("manifest identifies the dev.11 social and exploration build and release URLs", async () => {
  const manifest = await readJson("module.json");
  assert.equal(manifest.id, "pf2e-action-forge");
  assert.equal(manifest.version, "0.1.0-dev.14");
  assert.equal(manifest.compatibility.minimum, "14");
  assert.equal(manifest.compatibility.verified, "14");
  assert.equal(manifest.relationships.systems[0].id, "pf2e");
  assert.equal(manifest.relationships.systems[0].compatibility.minimum, "8.4.0");
  assert.equal(manifest.url, "https://github.com/crypto-vbrthr/pf2e-action-forge");
  assert.equal(manifest.manifest, "https://github.com/crypto-vbrthr/pf2e-action-forge/releases/latest/download/module.json");
  assert.equal(manifest.download, "https://github.com/crypto-vbrthr/pf2e-action-forge/releases/download/v0.1.0-dev.14/pf2e-action-forge.zip");
});

test("English and German localization expose the same keys", async () => {
  const en = await readJson("lang/en.json");
  const de = await readJson("lang/de.json");
  assert.deepEqual(Object.keys(de).sort(), Object.keys(en).sort());
});

test("the core catalog contains the MVP, combat/movement, and dev.11 social/exploration actions", async () => {
  const { CORE_ACTIONS } = await import("../scripts/data/core-action-catalog.js");
  assert.equal(CORE_ACTIONS.length, 65);
  assert.deepEqual(
    CORE_ACTIONS.map((action) => action.id).sort(),
    [
      "administer-first-aid-stabilize", "administer-first-aid-stop-bleeding", "aid", "avoid-notice-exploration", "balance", "climb",
      "coerce", "command-an-animal", "conceal-an-object", "cover-tracks", "craft", "create-a-diversion",
      "create-forgery", "decipher-writing", "defend-exploration", "demoralize", "detect-magic-exploration", "disable-a-device", "disarm", "earn-income",
      "escape", "exploration-search", "feint", "follow-the-expert", "force-open", "gather-information", "grapple", "hide", "high-jump", "hustle", "identify-alchemy",
      "identify-magic", "impersonate", "investigate-exploration", "learn-a-spell", "lie", "long-jump", "make-an-impression",
      "maneuver-in-flight", "palm-an-object", "perform", "pick-a-lock", "prepare-from-spellbook",
      "recall-knowledge", "repair", "repeat-a-spell", "reposition", "request", "scout", "seek", "sense-direction", "sense-motive", "shove", "sneak",
      "squeeze", "steal", "subsist", "sustain-an-effect", "swim", "track", "treat-disease", "treat-poison", "treat-wounds",
      "trip", "tumble-through"
    ].sort()
  );
  for (const action of CORE_ACTIONS) {
    assert.ok(action.category);
    assert.ok(action.categoryLabel);
    assert.ok(action.categoryIcon);
    assert.ok(Number.isFinite(action.categoryOrder));
    assert.ok(Number.isFinite(action.order));
    assert.ok(Array.isArray(action.keywords));
  }
});

test("action registry supports batch registration and stable catalog ordering", async () => {
  const { ActionRegistry } = await import("../scripts/core/action-registry.js");
  const registry = new ActionRegistry();
  registry.registerMany([
    { id: "b", label: "B", category: "later", categoryOrder: 20, order: 1 },
    { id: "c", label: "C", category: "first", categoryOrder: 10, order: 2 },
    { id: "a", label: "A", category: "first", categoryOrder: 10, order: 1 }
  ]);
  assert.deepEqual(registry.list().map((action) => action.id), ["a", "c", "b"]);
  assert.throws(() => registry.register({ id: "a", label: "Again" }), /Duplicate action id/);
  assert.ok(Object.isFrozen(registry.get("a")));
  assert.ok(Object.isFrozen(registry.get("a").keywords));
});

test("favorites are personal user flags and toggle without duplicates", async () => {
  const oldGame = globalThis.game;
  let stored = ["grapple", "grapple"];
  const writes = [];

  try {
    globalThis.game = {
      user: {
        getFlag: (scope, key) => {
          assert.equal(scope, "pf2e-action-forge");
          assert.equal(key, "favorites");
          return stored;
        },
        setFlag: async (scope, key, value) => {
          assert.equal(scope, "pf2e-action-forge");
          assert.equal(key, "favorites");
          stored = [...value];
          writes.push([...value]);
        }
      }
    };

    const { FavoritesService } = await import(`../scripts/core/favorites-service.js?favorites=${Date.now()}`);
    const service = new FavoritesService();
    assert.deepEqual(service.getIds(), ["grapple"]);

    const added = await service.toggle("trip");
    assert.equal(added.added, true);
    assert.deepEqual(new Set(stored), new Set(["grapple", "trip"]));

    const removed = await service.toggle("grapple");
    assert.equal(removed.added, false);
    assert.deepEqual(stored, ["trip"]);
    assert.equal(writes.length, 2);
  } finally {
    globalThis.game = oldGame;
  }
});

test("catalog template includes search, category groups, and favorite controls", async () => {
  const template = await readFile(new URL("templates/action-forge.hbs", root), "utf8");
  assert.match(template, /data-role="action-search"/);
  assert.match(template, /data-action-group/);
  assert.match(template, /data-action="toggleFavorite"/);
  assert.match(template, /data-search-text/);
  assert.doesNotMatch(template, /Foundation Check/);
});

test("repository history records dev.8 and preserves earlier development history", async () => {
  const changelog = await readFile(new URL("CHANGELOG.md", root), "utf8");
  const readme = await readFile(new URL("README.md", root), "utf8");
  const license = await readFile(new URL("LICENSE", root), "utf8");
  assert.match(changelog, /0\.1\.0-dev\.8/);
  assert.match(changelog, /0\.1\.0-dev\.7/);
  assert.match(changelog, /0\.1\.0-dev\.5\.3/);
  assert.match(changelog, /0\.1\.0-dev\.5\.2/);
  assert.match(readme, /Treat Wounds|Out-of-Combat Target Picker/);
  assert.match(readme, /GM DC Handoff/i);
  assert.match(readme, /Visibility profiles/i);
  assert.match(license, /MIT License/);
});


test("Action Cards override Foundry compact button sizing so text cannot be vertically clipped", async () => {
  const css = await readFile(new URL("styles/action-forge.css", root), "utf8");
  assert.match(css, /\.af-action-run \{[\s\S]*height: auto;/);
  assert.match(css, /\.af-action-run \{[\s\S]*min-height: 84px;/);
  assert.match(css, /\.af-action-run \{[\s\S]*white-space: normal;/);
  assert.match(css, /\.af-action-copy strong,[\s\S]*\.af-action-copy small[\s\S]*overflow: visible;/);
});

test("all MVP actions declare normalized target metadata", async () => {
  const { CORE_ACTIONS } = await import("../scripts/data/core-action-catalog.js");
  const expected = new Map([
    ["escape", "single"],
    ["sense-motive", "single"],
    ["seek", "none"],
    ["aid", "single"],
    ["exploration-search", "none"],
    ["follow-the-expert", "single"],
    ["sustain-an-effect", "none"],
    ["hustle", "none"],
    ["detect-magic-exploration", "none"],
    ["scout", "none"],
    ["avoid-notice-exploration", "none"],
    ["investigate-exploration", "none"],
    ["defend-exploration", "none"],
    ["repeat-a-spell", "none"],
    ["recall-knowledge", "optional"],
    ["earn-income", "none"],
    ["identify-magic", "none"],
    ["decipher-writing", "none"],
    ["learn-a-spell", "none"],
    ["prepare-from-spellbook", "none"],
    ["maneuver-in-flight", "none"],
    ["create-forgery", "none"],
    ["command-an-animal", "single"],
    ["subsist", "none"],
    ["balance", "none"],
    ["tumble-through", "single"],
    ["squeeze", "none"],
    ["grapple", "single"],
    ["trip", "single"],
    ["shove", "single"],
    ["reposition", "single"],
    ["disarm", "single"],
    ["force-open", "none"],
    ["climb", "none"],
    ["swim", "none"],
    ["high-jump", "none"],
    ["long-jump", "none"],
    ["perform", "none"],
    ["make-an-impression", "single"],
    ["request", "single"],
    ["gather-information", "none"],
    ["create-a-diversion", "multiple"],
    ["lie", "multiple"],
    ["impersonate", "optional"],
    ["feint", "single"],
    ["coerce", "single"],
    ["demoralize", "single"],
    ["palm-an-object", "multiple"],
    ["steal", "single"],
    ["disable-a-device", "none"],
    ["pick-a-lock", "none"],
    ["repair", "none"],
    ["identify-alchemy", "none"],
    ["craft", "none"],
    ["administer-first-aid-stabilize", "single"],
    ["administer-first-aid-stop-bleeding", "single"],
    ["treat-disease", "single"],
    ["treat-poison", "single"],
    ["treat-wounds", "single"],
    ["conceal-an-object", "optional"],
    ["hide", "optional"],
    ["sneak", "optional"],
    ["sense-direction", "none"],
    ["track", "none"],
    ["cover-tracks", "none"]
  ]);

  for (const action of CORE_ACTIONS) {
    assert.equal(action.target?.mode, expected.get(action.id));
    assert.equal(action.target?.type, "creature");
  }

  const { ActionRegistry } = await import("../scripts/core/action-registry.js");
  const registry = new ActionRegistry();
  const normalized = registry.register({ id: "target-test", label: "Target.Test", target: { mode: "single" } });
  assert.equal(normalized.target.mode, "single");
  assert.ok(Object.isFrozen(normalized.target));
});

test("target resolver handles canvas, sidebar, single-target precedence, and multi-target deduplication", async () => {
  const oldGame = globalThis.game;
  const oldCanvas = globalThis.canvas;
  const oldConst = globalThis.CONST;
  const oldTextEditor = globalThis.TextEditor;
  const oldFromUuid = globalThis.fromUuid;

  const creature = (id, name) => ({
    id,
    uuid: `Actor.${id}`,
    name,
    img: `${id}.webp`,
    type: "npc",
    visible: true,
    isOfType: (type) => type === "creature",
    testUserPermission: (_user, level) => level === 1
  });

  const actor1 = creature("one", "One");
  const actor2 = creature("two", "Two");
  const actor3 = creature("three", "Three");
  const makeToken = (id, actor) => {
    const token = {
      uuid: `Scene.scene.Token.${id}`,
      name: `${actor.name} Token`,
      actor,
      document: { uuid: `Scene.scene.Token.${id}`, texture: { src: `${id}-token.webp` } },
      setTarget: (targeted) => {
        if (!globalThis.game?.user?.targets) return;
        if (targeted) globalThis.game.user.targets.add(token);
        else globalThis.game.user.targets.delete(token);
      }
    };
    return token;
  };
  const token1 = makeToken("one", actor1);
  const token2 = makeToken("two", actor2);

  try {
    globalThis.game = {
      user: { id: "user", isGM: false, targets: new Set([token1, token2]) },
      actors: { get: (id) => [actor1, actor2, actor3].find((actor) => actor.id === id) ?? null }
    };
    globalThis.canvas = { scene: null };
    globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { LIMITED: 1 } };
    globalThis.TextEditor = { getDragEventData: () => ({ uuid: actor3.uuid }) };
    globalThis.fromUuid = async (uuid) => [actor1, actor2, actor3].find((actor) => actor.uuid === uuid) ?? null;

    const { TargetResolver } = await import(`../scripts/core/target-resolver.js?targets=${Date.now()}`);
    const resolver = new TargetResolver();
    const single = { id: "single", target: { mode: "single" } };
    resolver.activate(single);

    let state = resolver.getState(single);
    assert.equal(state.count, 1);
    assert.equal(state.targets[0].actor, actor2, "the most recent canvas target should be used");
    assert.equal(state.canvasOverflow, true);
    assert.equal(state.valid, true);

    const dropped = await resolver.addFromDropEvent({ dataTransfer: { getData: () => "" } }, single);
    assert.equal(dropped.ok, true);
    state = resolver.getState(single);
    assert.equal(state.targets[0].actor, actor3, "a dropped Actor should take temporary precedence");
    assert.equal(state.targets[0].source, "sidebar");
    assert.equal(state.canvasOverflow, false);
    assert.equal(globalThis.game.user.targets.size, 0, "an explicit sidebar target should release stale canvas targets");

    // Re-target canvas tokens before testing multiple-target combination.
    globalThis.game.user.targets.add(token1);
    globalThis.game.user.targets.add(token2);

    const multiple = { id: "multiple", target: { mode: "multiple" } };
    resolver.activate(multiple);
    globalThis.TextEditor.getDragEventData = () => ({ uuid: actor1.uuid });
    await resolver.addFromDropEvent({ dataTransfer: { getData: () => "" } }, multiple);
    state = resolver.getState(multiple);
    assert.equal(state.count, 2, "dropping an Actor already represented by a token target should not duplicate it");
    assert.deepEqual(new Set(state.targets.map((entry) => entry.actor)), new Set([actor1, actor2]));
  } finally {
    globalThis.game = oldGame;
    globalThis.canvas = oldCanvas;
    globalThis.CONST = oldConst;
    globalThis.TextEditor = oldTextEditor;
    globalThis.fromUuid = oldFromUuid;
  }
});

test("target workspace is present in the application template", async () => {
  const template = await readFile(new URL("templates/action-forge.hbs", root), "utf8");
  assert.match(template, /data-role="target-drop-zone"/);
  assert.match(template, /data-action="removeTarget"/);
  assert.match(template, /data-action="useCanvasTargets"/);
  assert.match(template, /targetContext\.canvasOverflow/);
});

test("dev.10 catalog preserves MVP workflows and enables the combat/movement expansion", async () => {
  const { CORE_ACTIONS } = await import("../scripts/data/core-action-catalog.js");
  const byId = new Map(CORE_ACTIONS.map((action) => [action.id, action]));

  const tumble = byId.get("tumble-through");
  assert.equal(tumble.dc.strategy, "target-defense");
  assert.equal(tumble.dc.defense, "reflex");
  assert.equal(tumble.dc.manualFallback, true);
  assert.equal(tumble.target.required, false);
  assert.equal(tumble.systemAction.slug, "tumble-through");
  assert.deepEqual(tumble.execution, { enabled: true, statistic: "acrobatics" });

  const climb = byId.get("climb");
  assert.equal(climb.dc.strategy, "manual");
  assert.equal(climb.systemAction.slug, "climb");
  assert.deepEqual(climb.execution, { enabled: true, statistic: "athletics" });

  assert.equal(byId.get("grapple").dc.defense, "fortitude");
  assert.equal(byId.get("trip").dc.defense, "reflex");
  assert.equal(byId.get("lie").dc.defense, "perception");
  assert.equal(byId.get("demoralize").dc.defense, "will");
  assert.deepEqual(byId.get("treat-wounds").dc.choices.map((choice) => choice.value), [15, 20, 30, 40]);
  assert.deepEqual(byId.get("treat-wounds").dc.choices.map((choice) => choice.minRank), [1, 2, 3, 4]);

  assert.equal(byId.get("recall-knowledge").dc.systemTargetFallback, true);
  assert.equal(byId.get("recall-knowledge").dc.systemTargetRequiresStatisticMatch, true);
  assert.equal(byId.get("recall-knowledge").dc.allowUnknown, true);
  assert.equal(byId.get("recall-knowledge").execution.requiresStatistic, true);
  assert.equal(byId.get("recall-knowledge").execution.includeLore, true);
  assert.deepEqual(byId.get("recall-knowledge").visibility, { announcement: "player-gm", roll: "blind", outcome: "gm" });
  assert.equal(byId.get("lie").execution.singleTargetOnly, true);
  assert.deepEqual(byId.get("lie").visibility, { announcement: "none", roll: "blind", outcome: "gm" });

  const enabled = new Set(CORE_ACTIONS.filter((action) => action.execution.enabled).map((action) => action.id));
  for (const id of [
    "balance", "climb", "create-a-diversion", "demoralize", "disarm", "feint", "force-open",
    "grapple", "high-jump", "lie", "long-jump", "recall-knowledge", "reposition", "shove",
    "squeeze", "swim", "treat-wounds", "trip", "tumble-through"
  ]) {
    assert.ok(enabled.has(id), `${id} should remain enabled after later catalog expansions`);
  }
});

test("dev.5 template exposes DC, skill selection, visibility, and real roll controls", async () => {
  const template = await readFile(new URL("templates/action-forge.hbs", root), "utf8");
  assert.match(template, /data-role="manual-dc"/);
  assert.match(template, /data-role="dc-status"/);
  assert.match(template, /data-action="executeAction"/);
  assert.match(template, /executionContext\.systemActionAvailable/);
  assert.match(template, /lastRoll/);
  assert.match(template, /data-role="execution-statistic"/);
  assert.match(template, /af-visibility-panel/);
  assert.match(template, /lastRoll\.hidden/);
});


test("action workspace exposes a frozen source-Actor state", async () => {
  const template = await readFile(new URL("templates/action-forge.hbs", root), "utf8");
  const app = await readFile(new URL("scripts/ui/action-forge-app.js", root), "utf8");
  assert.match(template, /sourceActorLocked/);
  assert.match(template, /data-role="source-actor" \{\{#if sourceActorLocked\}\}disabled/);
  assert.match(template, /PF2EActionForge\.SourceActor\.Locked/);
  assert.match(app, /actorResolver\.lockActionActor\(actor\)/);
  assert.match(app, /actorResolver\.unlockActionActor\(\)/);
});
