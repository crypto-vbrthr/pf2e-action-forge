import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

function withGet(users) {
  users.get = (id) => users.find((user) => user.id === id) ?? null;
  return users;
}

test("GM DC handoff chooses one deterministic active GM", async () => {
  const { GmDcHandoff } = await import(`../scripts/core/gm-dc-handoff.js?broker=${Date.now()}`);
  const handoff = new GmDcHandoff();
  const query = async () => null;
  const users = [
    { id: "player", active: true, isGM: false },
    { id: "gm-b", active: true, isGM: true, query },
    { id: "gm-a", active: true, isGM: true, query },
    { id: "gm-0", active: false, isGM: true, query }
  ];

  assert.equal(handoff.getBroker(users)?.id, "gm-a");
  assert.equal(handoff.getBroker(users.filter((user) => !user.isGM)), null);
});

test("player GM-DC request reaches the selected GM through replicated ChatMessage transport", async () => {
  const oldGame = globalThis.game;
  const oldFoundry = globalThis.foundry;
  const oldChatMessage = globalThis.ChatMessage;
  try {
    const player = { id: "player", active: true, isGM: false };
    const gm = { id: "gm", active: true, isGM: true };
    const users = withGet([player, gm]);
    const playerGame = {
      user: player,
      users,
      i18n: { localize: (key) => key, format: (_key, data) => JSON.stringify(data) },
      socket: null
    };
    const gmGame = {
      user: gm,
      users,
      i18n: playerGame.i18n,
      socket: null
    };
    globalThis.game = playerGame;
    globalThis.foundry = {
      utils: { escapeHTML: (value) => String(value), randomID: () => "request-id" },
      applications: { api: { DialogV2: { input: async () => ({ dc: "27" }) } } }
    };

    const { GmDcHandoff, GM_DC_CHAT_FLAG } = await import(`../scripts/core/gm-dc-handoff.js?chat-primary=${Date.now()}`);
    const handoff = new GmDcHandoff();
    let createdData = null;
    const message = {
      id: "transport-message",
      author: { id: player.id },
      flags: {},
      async update(changes) {
        const response = changes[`flags.pf2e-action-forge.${GM_DC_CHAT_FLAG}.response`];
        this.flags["pf2e-action-forge"][GM_DC_CHAT_FLAG].response = response;
        globalThis.game = playerGame;
        handoff.onChatMessageUpdated(this);
        return this;
      },
      async delete() { return this; }
    };
    globalThis.ChatMessage = class ChatMessage {
      static getSpeaker() { return { alias: "PF2E Action Forge" }; }
      static async create(data) {
        createdData = data;
        message.flags = data.flags;
        queueMicrotask(async () => {
          globalThis.game = gmGame;
          await handoff.onChatMessageCreated(message, player.id);
        });
        return message;
      }
    };

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
    assert.deepEqual(createdData.whisper.sort(), ["gm", "player"]);
    assert.equal(createdData.flags["pf2e-action-forge"][GM_DC_CHAT_FLAG].request.brokerId, "gm");
    assert.match(createdData.content, /pf2e-action-forge-gm-dc-transport/);
  } finally {
    globalThis.game = oldGame;
    globalThis.foundry = oldFoundry;
    globalThis.ChatMessage = oldChatMessage;
  }
});

test("duplicate replicated GM-DC deliveries share one adjudication instead of rejecting", async () => {
  const oldGame = globalThis.game;
  const oldFoundry = globalThis.foundry;
  try {
    const player = { id: "player", active: true, isGM: false };
    const gm = { id: "gm", active: true, isGM: true };
    const users = withGet([player, gm]);
    let dialogCalls = 0;
    let releaseDialog;
    const dialogResult = new Promise((resolve) => { releaseDialog = resolve; });

    globalThis.game = {
      user: gm,
      users,
      i18n: { localize: (key) => key, format: (_key, data) => JSON.stringify(data) },
      socket: null
    };
    globalThis.foundry = {
      utils: { escapeHTML: (value) => String(value), randomID: () => "request-id" },
      applications: { api: { DialogV2: { input: async () => { dialogCalls += 1; return dialogResult; } } } }
    };

    const { GmDcHandoff, GM_DC_CHAT_FLAG } = await import(`../scripts/core/gm-dc-handoff.js?duplicate-delivery=${Date.now()}`);
    const handoff = new GmDcHandoff();
    const updates = [];
    const message = {
      author: { id: player.id },
      flags: {
        "pf2e-action-forge": {
          [GM_DC_CHAT_FLAG]: {
            request: {
              requesterId: player.id,
              brokerId: gm.id,
              requestId: "same-request",
              actionId: "recall-knowledge",
              actionName: "Recall Knowledge",
              actorName: "Kikus",
              targetName: "Dragon",
              statisticLabel: "Dragon Lore"
            },
            response: null
          }
        }
      },
      async update(changes) {
        updates.push(changes[`flags.pf2e-action-forge.${GM_DC_CHAT_FLAG}.response`]);
        return this;
      },
      async delete() { return this; }
    };

    const first = handoff.onChatMessageCreated(message, player.id);
    const second = handoff.onChatMessageCreated(message, player.id);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(dialogCalls, 1);

    releaseDialog({ dc: "29" });
    await Promise.all([first, second]);

    assert.equal(dialogCalls, 1);
    assert.equal(updates.length, 2);
    assert.equal(updates[0].ok, true);
    assert.equal(updates[0].dc, 29);
    assert.deepEqual(updates[1], updates[0]);
    assert.notEqual(updates[0].reason, "duplicate-request");
  } finally {
    globalThis.game = oldGame;
    globalThis.foundry = oldFoundry;
  }
});

test("GM DC handoff cleanly reports cancellation and missing GM", async () => {
  const oldGame = globalThis.game;
  const oldFoundry = globalThis.foundry;
  const oldConfig = globalThis.CONFIG;
  const oldChatMessage = globalThis.ChatMessage;
  try {
    const player = { id: "player", active: true, isGM: false };
    const users = withGet([player]);
    globalThis.CONFIG = { queries: {} };
    globalThis.ChatMessage = undefined;
    globalThis.game = { user: player, users, i18n: { localize: (key) => key }, socket: null };
    globalThis.foundry = { applications: { api: { DialogV2: { input: async () => null } } } };
    const { GmDcHandoff } = await import(`../scripts/core/gm-dc-handoff.js?cancel=${Date.now()}`);
    const handoff = new GmDcHandoff();

    assert.deepEqual(await handoff.request({ requestId: "x" }), {
      ok: false,
      reason: "no-active-gm",
      requestId: "x"
    });

    const gm = { id: "gm", active: true, isGM: true };
    users.push(gm);
    globalThis.game = { ...globalThis.game, user: gm };
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
    globalThis.CONFIG = oldConfig;
    globalThis.ChatMessage = oldChatMessage;
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

test("Action Forge initializes the GM DC handoff and waits for the GM response before rolling", async () => {
  const app = await readFile(new URL("scripts/ui/action-forge-app.js", root), "utf8");
  const bootstrap = await readFile(new URL("scripts/action-forge.js", root), "utf8");
  const handoffSource = await readFile(new URL("scripts/core/gm-dc-handoff.js", root), "utf8");
  const requestAt = app.indexOf("await gmDcHandoff.request");
  const rollAt = app.indexOf("await pf2eActionAdapter.execute");
  assert.ok(requestAt >= 0);
  assert.ok(rollAt > requestAt);
  assert.match(app, /pendingGmDcRequest = \{ requestId, actionId: action\.id \}/);
  assert.match(app, /pendingGmDcRequest\?\.requestId !== requestId/);
  assert.match(app, /app\.pendingGmDcRequest = null;\n    app\.activeActionId = null;/);
  assert.match(app, /async _preClose\(options\)[\s\S]*pendingGmDcRequest = null;[\s\S]*unlockActionActor/);
  assert.match(bootstrap, /gmDcHandoff\.registerQueryHandler\(\)/);
  assert.match(bootstrap, /gmDcHandoff\.initialize\(\)/);
  assert.match(handoffSource, /type: "gm-dc-request"/);
  assert.match(handoffSource, /type: "gm-dc-ack"/);
  assert.match(handoffSource, /type: "gm-dc-response"/);
  assert.match(handoffSource, /await this\.#requestViaChat\(payload, broker\)/);
  assert.match(handoffSource, /Hooks\.on\("createChatMessage"/);
  assert.match(handoffSource, /Hooks\.on\("updateChatMessage"/);
  assert.match(handoffSource, /DialogV2\.input\(this\.#buildDialogConfig\(data\)\)/);

  const template = await readFile(new URL("templates/action-forge.hbs", root), "utf8");
  assert.match(template, /executionContext\.buttonText/);
  assert.match(template, /interactionLocked/);
});

test("GM DC handoff source uses replicated ChatMessage transport before remote query", async () => {
  const source = await readFile(new URL("scripts/core/gm-dc-handoff.js", root), "utf8");
  const chatAt = source.indexOf("await this.#requestViaChat(payload, broker)");
  const socketAt = source.indexOf("await this.#requestViaSocket(payload, broker)");
  const queryAt = source.indexOf("candidate.query(QUERY_NAME");
  assert.ok(chatAt >= 0);
  assert.ok(socketAt > chatAt);
  assert.ok(queryAt > socketAt);
  assert.match(source, /Hooks\.on\("createChatMessage"/);
  assert.match(source, /Hooks\.on\("updateChatMessage"/);
  assert.match(source, /flags\.\$\{MODULE_ID\}\.\$\{CHAT_FLAG\}\.response/);
  assert.match(source, /timeout: QUERY_TIMEOUT/);
});

test("internal GM DC transport messages are hidden from rendered chat", async () => {
  const oldHTMLElement = globalThis.HTMLElement;
  try {
    class FakeElement { constructor() { this.style = {}; } }
    globalThis.HTMLElement = FakeElement;
    const { GmDcHandoff, GM_DC_CHAT_FLAG } = await import(`../scripts/core/gm-dc-handoff.js?hide=${Date.now()}`);
    const handoff = new GmDcHandoff();
    const rootEl = new FakeElement();
    handoff.hideInternalChatMessage({ flags: { "pf2e-action-forge": { [GM_DC_CHAT_FLAG]: { request: {} } } } }, rootEl);
    assert.equal(rootEl.style.display, "none");
  } finally {
    globalThis.HTMLElement = oldHTMLElement;
  }
});

test("GM DC diagnostics expose a client-local readable report through the module API", async () => {
  const source = await readFile(new URL("scripts/core/gm-dc-debug.js", root), "utf8");
  const bootstrap = await readFile(new URL("scripts/action-forge.js", root), "utf8");
  const handoffSource = await readFile(new URL("scripts/core/gm-dc-handoff.js", root), "utf8");

  assert.match(source, /\[PF2E Action Forge\]\[GM-DC\]/);
  assert.match(source, /snapshot\(\)/);
  assert.match(source, /async show\(\)/);
  assert.match(source, /async copy\(\)/);
  assert.match(bootstrap, /debug: Object\.freeze/);
  assert.match(bootstrap, /showGmDc: \(\) => gmDcDebugLog\.show\(\)/);
  assert.match(bootstrap, /copyGmDc: \(\) => gmDcDebugLog\.copy\(\)/);
  assert.match(handoffSource, /gmDcDebugLog\.add\("request\.start"/);
  assert.match(handoffSource, /gmDcDebugLog\.add\("hook\.createChatMessage"/);
  assert.match(handoffSource, /gmDcDebugLog\.add\("chat\.created\.drop"/);
  assert.match(handoffSource, /gmDcDebugLog\.add\("prompt\.open"/);
  assert.match(handoffSource, /gmDcDebugLog\.add\("pending\.resolve\.chat"/);
});

test("GM DC dialog keeps Foundry i18n.format bound to the localization object", async () => {
  const oldGame = globalThis.game;
  const oldFoundry = globalThis.foundry;
  try {
    const gm = { id: "gm", active: true, isGM: true };
    const users = withGet([gm]);
    const i18n = {
      translations: { ready: true },
      localize(key) { return key; },
      format(key, data) {
        assert.equal(this, i18n);
        assert.equal(this.translations.ready, true);
        return `${key}:${JSON.stringify(data)}`;
      }
    };
    globalThis.game = { user: gm, users, i18n, socket: null };
    globalThis.foundry = {
      utils: { escapeHTML: (value) => String(value) },
      applications: { api: { DialogV2: { input: async () => ({ dc: "24" }) } } }
    };

    const { GmDcHandoff } = await import(`../scripts/core/gm-dc-handoff.js?bound-i18n=${Date.now()}`);
    const result = await new GmDcHandoff().request({
      definition: { id: "earn-income", label: "PF2EActionForge.Actions.EarnIncome.Name" },
      actor: { name: "Kikus" },
      statisticLabel: "Performance (+11)",
      requestId: "bound-i18n-request"
    });

    assert.equal(result.ok, true);
    assert.equal(result.dc, 24);
  } finally {
    globalThis.game = oldGame;
    globalThis.foundry = oldFoundry;
  }
});
