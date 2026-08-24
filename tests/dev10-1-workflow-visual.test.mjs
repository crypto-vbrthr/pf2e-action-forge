import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

test("dev.10.1 visually separates execution workflow from the action catalog", async () => {
  const template = await readFile(new URL("templates/action-forge.hbs", root), "utf8");
  const css = await readFile(new URL("styles/action-forge.css", root), "utf8");

  assert.match(template, /\{\{#if activeAction\}\}[\s\S]*class="af-execution-workflow"[\s\S]*class="af-target-panel"[\s\S]*class="af-dc-panel"[\s\S]*<\/div>\s*\{\{\/if\}\}/);
  assert.match(css, /--af-workflow-accent:\s*#a989ff/);
  assert.match(css, /\.af-execution-workflow\s*\{[\s\S]*var\(--af-workflow-accent\)/);
  assert.match(css, /\.af-execution-workflow \.af-primary-button\s*\{[\s\S]*var\(--af-workflow-accent\)/);
  assert.match(css, /\.af-action-card:hover,[\s\S]*border-color:\s*var\(--af-accent\)/);
});
