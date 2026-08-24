import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

async function resolver() {
  const { DCResolver } = await import(`../scripts/core/dc-resolver.js?dev14-1=${Date.now()}-${Math.random()}`);
  return new DCResolver();
}

test("manual environmental DCs require GM handoff for players but stay directly editable for GMs", async () => {
  const action = { dc: { strategy: "manual" } };
  const targets = { targets: [] };
  const dc = await resolver();

  const injectedPlayer = dc.getState(action, targets, { manualDc: 23, user: { isGM: false } });
  assert.equal(injectedPlayer.valid, true);
  assert.equal(injectedPlayer.source, "gm");
  assert.equal(injectedPlayer.difficultyClass, undefined);
  assert.equal(injectedPlayer.allowsManualDc, false);
  assert.equal(injectedPlayer.requiresGmHandoff, true);

  const gmMissing = dc.getState(action, targets, { user: { isGM: true } });
  assert.equal(gmMissing.valid, false);
  assert.equal(gmMissing.needsManualDc, true);
  assert.equal(gmMissing.allowsManualDc, true);

  const gmReady = dc.getState(action, targets, { manualDc: 23, user: { isGM: true } });
  assert.equal(gmReady.valid, true);
  assert.equal(gmReady.source, "manual");
  assert.equal(gmReady.difficultyClass, 23);
});

test("target-defense manual fallback is GM-authoritative when no target can provide the defense", async () => {
  const action = { dc: { strategy: "target-defense", defense: "athletics", manualFallback: true } };
  const targets = { targets: [] };
  const dc = await resolver();

  const player = dc.getState(action, targets, { manualDc: 30, user: { isGM: false } });
  assert.equal(player.valid, true);
  assert.equal(player.source, "gm");
  assert.equal(player.difficultyClass, undefined);
  assert.equal(player.allowsManualDc, false);
  assert.equal(player.requiresGmHandoff, true);

  const gm = dc.getState(action, targets, { manualDc: 30, user: { isGM: true } });
  assert.equal(gm.valid, true);
  assert.equal(gm.source, "manual");
  assert.equal(gm.difficultyClass, 30);
});

test("rules-defined fixed choices remain player-selectable while arbitrary overrides are GM-only", async () => {
  const action = {
    dc: {
      strategy: "fixed-choice",
      allowCustom: true,
      choices: [{ value: 15 }, { value: 20 }]
    }
  };
  const targets = { targets: [] };
  const dc = await resolver();

  const playerChoice = dc.getState(action, targets, { manualDc: 20, user: { isGM: false } });
  assert.equal(playerChoice.valid, true);
  assert.equal(playerChoice.difficultyClass, 20);
  assert.equal(playerChoice.source, "fixed-choice");
  assert.equal(playerChoice.allowsManualDc, false);

  const injectedCustom = dc.getState(action, targets, { manualDc: 27, user: { isGM: false } });
  assert.equal(injectedCustom.valid, true);
  assert.equal(injectedCustom.difficultyClass, 15);
  assert.equal(injectedCustom.source, "fixed-choice");
  assert.equal(injectedCustom.custom, false);
  assert.equal(injectedCustom.customRequested, true);
  assert.equal(injectedCustom.allowsManualDc, false);

  const gmCustom = dc.getState(action, targets, { manualDc: 27, user: { isGM: true } });
  assert.equal(gmCustom.valid, true);
  assert.equal(gmCustom.difficultyClass, 27);
  assert.equal(gmCustom.source, "fixed-choice-custom");
  assert.equal(gmCustom.custom, true);
  assert.equal(gmCustom.allowsManualDc, true);
});

test("Action Forge never accepts free-form manual DC input from a player client", async () => {
  const app = await readFile(new URL("scripts/ui/action-forge-app.js", root), "utf8");
  assert.match(app, /Free-form DC entry is GM-only/);
  assert.match(app, /if \(!game\.user\?\.isGM\) return;/);
  assert.match(app, /state\.strategy === "manual" && state\.allowsManualDc/);
});
