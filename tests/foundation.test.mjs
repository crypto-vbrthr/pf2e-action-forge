import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));

test("manifest identifies the development build and Foundry/PF2e compatibility", async () => {
  const manifest = await readJson("module.json");
  assert.equal(manifest.id, "pf2e-action-forge");
  assert.equal(manifest.version, "0.1.0-dev.1.1");
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
