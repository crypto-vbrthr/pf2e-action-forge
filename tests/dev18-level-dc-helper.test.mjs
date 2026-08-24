import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

test("level DC helper reproduces the GM Core level table from 0 through 25", async () => {
  const { LEVEL_DCS, calculateLevelDc } = await import(`../scripts/core/level-dc-calculator.js?table=${Date.now()}`);
  assert.equal(Object.keys(LEVEL_DCS).length, 26);
  assert.deepEqual(calculateLevelDc(0, "standard"), {
    level: 0, baseDc: 14, difficulty: "standard", adjustment: 0, dc: 14
  });
  assert.equal(calculateLevelDc(5, "standard")?.dc, 20);
  assert.equal(calculateLevelDc(12, "standard")?.dc, 30);
  assert.equal(calculateLevelDc(20, "standard")?.dc, 40);
  assert.equal(calculateLevelDc(25, "standard")?.dc, 50);
});

test("level DC helper applies the page 53 difficulty adjustments exactly", async () => {
  const { calculateLevelDc } = await import(`../scripts/core/level-dc-calculator.js?adjust=${Date.now()}`);
  assert.equal(calculateLevelDc(10, "incredibly-easy")?.dc, 17);
  assert.equal(calculateLevelDc(10, "very-easy")?.dc, 22);
  assert.equal(calculateLevelDc(10, "easy")?.dc, 25);
  assert.equal(calculateLevelDc(10, "hard")?.dc, 29);
  assert.equal(calculateLevelDc(10, "very-hard")?.dc, 32);
  assert.equal(calculateLevelDc(10, "incredibly-hard")?.dc, 37);
  assert.equal(calculateLevelDc("", "standard"), null);
  assert.equal(calculateLevelDc(26, "standard"), null);
  assert.equal(calculateLevelDc(10, "impossible"), null);
});

test("GM handoff can calculate a DC from level and difficulty when the manual field is blank", async () => {
  const oldGame = globalThis.game;
  const oldFoundry = globalThis.foundry;
  try {
    const gm = { id: "gm", active: true, isGM: true };
    const users = [gm];
    users.get = (id) => users.find((user) => user.id === id) ?? null;
    globalThis.game = {
      user: gm,
      users,
      i18n: {
        localize: (key) => key,
        format: (key, data) => `${key}:${JSON.stringify(data)}`
      }
    };
    globalThis.foundry = {
      utils: { escapeHTML: (value) => String(value) },
      applications: { api: { DialogV2: {
        input: async () => ({ dc: "", levelDcLevel: "15", levelDcDifficulty: "very-hard" })
      } } }
    };

    const { GmDcHandoff } = await import(`../scripts/core/gm-dc-handoff.js?dev18=${Date.now()}`);
    const result = await new GmDcHandoff().request({ definition: { id: "x", label: "X" }, actor: { name: "Hero" } });
    assert.equal(result.ok, true);
    assert.equal(result.dc, 39);
    assert.equal(result.dcSource, "level");
  } finally {
    globalThis.game = oldGame;
    globalThis.foundry = oldFoundry;
  }
});

test("GM handoff keeps an explicitly entered manual DC authoritative", async () => {
  const { resolveResponseDc } = await import(`../scripts/core/gm-dc-handoff.js?manual=${Date.now()}`);
  const result = resolveResponseDc({ dc: "27", levelDcLevel: "15", levelDcDifficulty: "very-hard" });
  assert.deepEqual(result, { dc: 27, source: "manual" });
});

test("both the GM workspace and remote GM request expose the level-based DC helper", async () => {
  const app = await readFile(new URL("scripts/ui/action-forge-app.js", root), "utf8");
  const template = await readFile(new URL("templates/action-forge.hbs", root), "utf8");
  const handoff = await readFile(new URL("scripts/core/gm-dc-handoff.js", root), "utf8");
  assert.match(app, /calculateLevelDc/);
  assert.match(app, /data-role=\\?"level-dc-level\\?"|level-dc-level/);
  assert.match(template, /data-role="level-dc-level"/);
  assert.match(template, /data-role="level-dc-difficulty"/);
  assert.match(handoff, /name="levelDcLevel"/);
  assert.match(handoff, /name="levelDcDifficulty"/);
});
