import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));

test("manifest identifies the dev.2.1 release and release URLs", async () => {
  const manifest = await readJson("module.json");
  assert.equal(manifest.id, "pf2e-action-forge");
  assert.equal(manifest.version, "0.1.0-dev.2.1");
  assert.equal(manifest.compatibility.minimum, "14");
  assert.equal(manifest.compatibility.verified, "14");
  assert.equal(manifest.relationships.systems[0].id, "pf2e");
  assert.equal(manifest.relationships.systems[0].compatibility.minimum, "8.4.0");
  assert.equal(manifest.url, "https://github.com/crypto-vbrthr/pf2e-action-forge");
  assert.equal(manifest.manifest, "https://github.com/crypto-vbrthr/pf2e-action-forge/releases/latest/download/module.json");
  assert.equal(manifest.download, "https://github.com/crypto-vbrthr/pf2e-action-forge/releases/download/v0.1.0-dev.2.1/pf2e-action-forge.zip");
});

test("English and German localization expose the same keys", async () => {
  const en = await readJson("lang/en.json");
  const de = await readJson("lang/de.json");
  assert.deepEqual(Object.keys(de).sort(), Object.keys(en).sort());
});

test("the MVP catalog contains the eight planned actions and category metadata", async () => {
  const { CORE_ACTIONS } = await import("../scripts/data/core-action-catalog.js");
  assert.equal(CORE_ACTIONS.length, 8);
  assert.deepEqual(
    CORE_ACTIONS.map((action) => action.id).sort(),
    ["climb", "demoralize", "grapple", "lie", "recall-knowledge", "treat-wounds", "trip", "tumble-through"].sort()
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

test("repository history records dev.2.1", async () => {
  const changelog = await readFile(new URL("CHANGELOG.md", root), "utf8");
  const readme = await readFile(new URL("README.md", root), "utf8");
  const license = await readFile(new URL("LICENSE", root), "utf8");
  assert.match(changelog, /0\.1\.0-dev\.2\.1/);
  assert.match(readme, /Action Catalog & Favorites/);
  assert.match(license, /MIT License/);
});


test("Action Cards override Foundry compact button sizing so text cannot be vertically clipped", async () => {
  const css = await readFile(new URL("styles/action-forge.css", root), "utf8");
  assert.match(css, /\.af-action-run \{[\s\S]*height: auto;/);
  assert.match(css, /\.af-action-run \{[\s\S]*min-height: 84px;/);
  assert.match(css, /\.af-action-run \{[\s\S]*white-space: normal;/);
  assert.match(css, /\.af-action-copy strong,[\s\S]*\.af-action-copy small[\s\S]*overflow: visible;/);
});
