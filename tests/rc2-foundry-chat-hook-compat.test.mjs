import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

async function jsFiles(dirUrl) {
  const entries = await readdir(dirUrl, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const url = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dirUrl);
    if (entry.isDirectory()) files.push(...await jsFiles(url));
    else if (entry.name.endsWith(".js")) files.push(url);
  }
  return files;
}

test("rc.2 ships no deprecated renderChatMessage hook registrations", async () => {
  const files = await jsFiles(new URL("scripts/", root));
  const offenders = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (/Hooks\.on\(["']renderChatMessage["']/.test(source)) offenders.push(file.pathname);
  }
  assert.deepEqual(offenders, []);
});

test("rc.2 retains renderChatMessageHTML handlers for chat DOM work", async () => {
  const bootstrap = await readFile(new URL("scripts/action-forge.js", root), "utf8");
  const handoff = await readFile(new URL("scripts/core/gm-dc-handoff.js", root), "utf8");
  assert.match(bootstrap, /Hooks\.on\("renderChatMessageHTML", decorateApplicationMessage\)/);
  assert.match(handoff, /Hooks\.on\("renderChatMessageHTML", hide\)/);
});
