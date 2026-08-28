import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { ActionRegistry } from "../scripts/core/action-registry.js";
import { CORE_ACTIONS } from "../scripts/data/core-action-catalog.js";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));

test("rc.3 release metadata, runtime fallbacks, and download URL are synchronized", async () => {
  const manifest = await readJson("module.json");
  const pkg = await readJson("package.json");
  const bootstrap = await readFile(new URL("scripts/action-forge.js", root), "utf8");
  const app = await readFile(new URL("scripts/ui/action-forge-app.js", root), "utf8");

  assert.equal(manifest.version, "0.1.0-rc.3.2");
  assert.equal(pkg.version, "0.1.0-rc.3.2");
  assert.equal(manifest.compatibility.minimum, "14");
  assert.equal(manifest.compatibility.verified, "14");
  assert.equal(manifest.relationships.systems[0].compatibility.minimum, "8.4.0");
  assert.equal(manifest.socket, true);
  assert.equal(manifest.download, "https://github.com/crypto-vbrthr/pf2e-action-forge/releases/download/v0.1.0-rc.3.2/pf2e-action-forge.zip");
  assert.match(bootstrap, /0\.1\.0-rc\.3/);
  assert.match(app, /0\.1\.0-rc\.3/);
  assert.doesNotMatch(bootstrap, /0\.1\.0-dev\./);
  assert.doesNotMatch(app, /0\.1\.0-dev\./);
});

test("rc.3 catalog remains 65 unique normalized actions with no development-only entries", () => {
  assert.equal(CORE_ACTIONS.length, 65);
  assert.equal(new Set(CORE_ACTIONS.map((action) => action.id)).size, 65);
  assert.equal(CORE_ACTIONS.filter((action) => action.developmentOnly).length, 0);

  const registry = new ActionRegistry();
  registry.registerMany(CORE_ACTIONS);
  assert.equal(registry.list().length, 65);
  for (const action of registry.list()) {
    assert.ok(Object.isFrozen(action), action.id);
    assert.ok(Object.isFrozen(action.target), `${action.id}: target`);
    assert.ok(Object.isFrozen(action.dc), `${action.id}: dc`);
    assert.ok(Object.isFrozen(action.execution), `${action.id}: execution`);
    assert.ok(Object.isFrozen(action.visibility), `${action.id}: visibility`);
    assert.ok(Object.isFrozen(action.prerequisites), `${action.id}: prerequisites`);
  }
});

test("Steal uses one shared Thievery check for the victim and selected observers", () => {
  const steal = CORE_ACTIONS.find((action) => action.id === "steal");
  assert.ok(steal);
  assert.equal(steal.target.mode, "multiple");
  assert.equal(steal.target.required, true);
  assert.equal(steal.dc.strategy, "target-defense");
  assert.equal(steal.dc.defense, "perception");
  assert.equal(steal.execution.statistic, "thievery");
  assert.equal(steal.execution.sharedRoll, true);
});

test("RC diagnostics retain the local trace API without normal info-level console spam", async () => {
  const debug = await readFile(new URL("scripts/core/gm-dc-debug.js", root), "utf8");
  const bootstrap = await readFile(new URL("scripts/action-forge.js", root), "utf8");
  assert.match(debug, /console\.debug\(`\[PF2E Action Forge\]\[GM-DC\]/);
  assert.doesNotMatch(debug, /console\.info\(`\[PF2E Action Forge\]\[GM-DC\] \$\{event\}/);
  assert.match(bootstrap, /getGmDcText/);
  assert.match(bootstrap, /showGmDc/);
  assert.match(bootstrap, /copyGmDc/);
  assert.match(bootstrap, /clearGmDc/);
});

test("German and English locale key sets remain identical in rc.3", async () => {
  const de = await readJson("lang/de.json");
  const en = await readJson("lang/en.json");
  assert.deepEqual(Object.keys(de).sort(), Object.keys(en).sort());
  assert.match(de["PF2EActionForge.Actions.Steal.Description"], /Beobachter/);
  assert.match(en["PF2EActionForge.Actions.Steal.Description"], /observers/);
});
