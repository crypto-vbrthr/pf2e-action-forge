import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../scripts/ui/action-forge-app.js", import.meta.url), "utf8");
const moduleJson = JSON.parse(fs.readFileSync(new URL("../module.json", import.meta.url), "utf8"));

test("native PF2e rolls yield the Action Forge window stack before opening a system dialog", () => {
  assert.match(source, /#yieldToSystemRollWindow\(\)/);
  assert.match(source, /element\.style\.removeProperty\("z-index"\)/);
  assert.match(source, /await app\.render\(\{ force: true \}\);\s*const restoreWindowStack = app\.#yieldToSystemRollWindow\(\);/s);
  assert.match(source, /finally \{\s*restoreWindowStack\(\);/s);
  assert.match(source, /this\.bringToFront\?\.\(\)/);
});

test("rc.3.2 release metadata is consistent", () => {
  assert.equal(moduleJson.version, "0.1.0-rc.3.2");
  assert.match(moduleJson.download, /v0\.1\.0-rc\.3\.2\/pf2e-action-forge\.zip$/);
});
