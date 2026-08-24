import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

test("dev.11.1 scrolls to the execution workflow only after explicit action selection", async () => {
  const app = await readFile(new URL("scripts/ui/action-forge-app.js", root), "utf8");
  const template = await readFile(new URL("templates/action-forge.hbs", root), "utf8");

  assert.match(template, /class="af-execution-workflow" data-role="execution-workflow"/);
  assert.match(app, /_scrollToExecutionAfterRender = false/);
  assert.match(app, /#scrollToExecutionAfterRender\(\)[\s\S]*data-role="execution-workflow"[\s\S]*shell\.scrollTo\(\{ top, behavior:/);
  assert.match(app, /#runAction\([\s\S]*app\._scrollToExecutionAfterRender = true;[\s\S]*app\.render\(\{ force: true \}\)/);
  assert.match(app, /#restoreUiStateAfterRender\(\);\s*this\.#scrollToExecutionAfterRender\(\);/);
});
