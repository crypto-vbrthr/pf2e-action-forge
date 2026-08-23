import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("GM DC handoff chooses one deterministic active GM", async () => {
  const { GmDcHandoff } = await import(`../scripts/core/gm-dc-handoff.js?broker=${Date.now()}`);
  const handoff = new GmDcHandoff();
  const users = [
    { id: "player", active: true, isGM: false },
    { id: "gm-b", active: true, isGM: true },
    { id: "gm-a", active: true, isGM: true },
    { id: "gm-0", active: false, isGM: true }
  ];

  assert.equal(handoff.getBroker(users)?.id, "gm-a");
  assert.equal(handoff.isAvailable(users), true);
  assert.equal(handoff.getBroker(users.filter((user) => !user.isGM)), null);
});

test("GM DC handoff uses Foundry v14 DialogV2.query and returns only a valid numeric DC", async () => {
  const oldGame = globalThis.game;
  const oldFoundry = globalThis.foundry;
  let query = null;
  try {
    const gm = { id: "gm", active: true, isGM: true };
    globalThis.game = {
      users: [{ id: "player", active: true, isGM: false }, gm],
      i18n: { localize: (key) => key }
    };
    globalThis.foundry = {
      utils: { escapeHTML: (value) => String(value), randomID: () => "request-id" },
      applications: {
        api: {
          DialogV2: {
            query: async (user, type, config) => {
              query = { user, type, config };
              return { dc: "27" };
            }
          }
        }
      }
    };

    const { GmDcHandoff } = await import(`../scripts/core/gm-dc-handoff.js?query=${Date.now()}`);
    const handoff = new GmDcHandoff();
    const result = await handoff.request({
      definition: { id: "recall-knowledge", label: "Action.Label" },
      actor: { name: "Kikus" },
      target: { name: "Shadow Dragon" },
      statisticLabel: "Dragon Lore (+18)",
      requestId: "request-id"
    });

    assert.equal(result.ok, true);
    assert.equal(result.dc, 27);
    assert.equal(result.gmId, "gm");
    assert.equal(query.user.id, "gm");
    assert.equal(query.type, "input");
    assert.match(query.config.content, /Kikus/);
    assert.match(query.config.content, /Shadow Dragon/);
    assert.match(query.config.content, /Dragon Lore/);
  } finally {
    globalThis.game = oldGame;
    globalThis.foundry = oldFoundry;
  }
});

test("GM DC handoff cleanly reports cancellation and missing GM", async () => {
  const oldGame = globalThis.game;
  const oldFoundry = globalThis.foundry;
  try {
    globalThis.game = { users: [], i18n: { localize: (key) => key } };
    globalThis.foundry = { applications: { api: { DialogV2: { query: async () => null } } } };
    const { GmDcHandoff } = await import(`../scripts/core/gm-dc-handoff.js?cancel=${Date.now()}`);
    const handoff = new GmDcHandoff();

    assert.deepEqual(await handoff.request({ requestId: "x" }), {
      ok: false,
      reason: "no-active-gm",
      requestId: "x"
    });

    const gm = { id: "gm", active: true, isGM: true };
    globalThis.game.users = [gm];
    const cancelled = await handoff.request({
      definition: { id: "test", label: "Test" },
      actor: { name: "Actor" },
      requestId: "y"
    });
    assert.equal(cancelled.ok, false);
    assert.equal(cancelled.reason, "rejected");
    assert.equal(cancelled.gmId, "gm");
  } finally {
    globalThis.game = oldGame;
    globalThis.foundry = oldFoundry;
  }
});

test("GM-defined secret DC requires a handoff for players and manual entry for GMs", async () => {
  const { DCResolver } = await import(`../scripts/core/dc-resolver.js?handoff-state=${Date.now()}`);
  const resolver = new DCResolver();
  const action = { dc: { strategy: "gm-defined", allowUnknown: true } };
  const targetState = { targets: [] };

  const player = resolver.getState(action, targetState, { statistic: "dragon-lore", user: { isGM: false } });
  assert.equal(player.valid, true);
  assert.equal(player.source, "gm");
  assert.equal(player.requiresGmHandoff, true);
  assert.equal(player.allowsManualDc, false);

  const gmMissing = resolver.getState(action, targetState, { statistic: "dragon-lore", user: { isGM: true } });
  assert.equal(gmMissing.valid, false);
  assert.equal(gmMissing.needsManualDc, true);
  assert.equal(gmMissing.allowsManualDc, true);
  assert.equal(gmMissing.requiresGmHandoff, false);

  const gmReady = resolver.getState(action, targetState, { statistic: "dragon-lore", manualDc: 31, user: { isGM: true } });
  assert.equal(gmReady.valid, true);
  assert.equal(gmReady.difficultyClass, 31);
});

test("Action Forge waits for the GM response before calling the PF2e roll adapter and invalidates cancelled requests", async () => {
  const app = await readFile(new URL("scripts/ui/action-forge-app.js", root), "utf8");
  const requestAt = app.indexOf("await gmDcHandoff.request");
  const rollAt = app.indexOf("await pf2eActionAdapter.execute");
  assert.ok(requestAt >= 0);
  assert.ok(rollAt > requestAt);
  assert.match(app, /pendingGmDcRequest = \{ requestId, actionId: action\.id \}/);
  assert.match(app, /pendingGmDcRequest\?\.requestId !== requestId/);
  assert.match(app, /app\.pendingGmDcRequest = null;\n    app\.activeActionId = null;/);
  assert.match(app, /async _preClose\(options\)[\s\S]*pendingGmDcRequest = null;[\s\S]*unlockActionActor/);

  const template = await readFile(new URL("templates/action-forge.hbs", root), "utf8");
  assert.match(template, /executionContext\.buttonText/);
  assert.match(template, /interactionLocked/);
});
