import { actionRegistry } from "./action-registry.js";
import { MODULE_ID } from "./action-transaction.js";
import { calculateLevelDc, getDifficultyOptions, getLevelDcOptions } from "./level-dc-calculator.js";
import { gmDcDebugLog } from "./gm-dc-debug.js";

const SOCKET = `module.${MODULE_ID}`;
const QUERY_NAME = `${MODULE_ID}.gmDcRequest`;
const CHAT_FLAG = "gmDcHandoff";
const REQUEST_TIMEOUT = 300000;
const SOCKET_ACK_TIMEOUT = 2500;
const QUERY_TIMEOUT = 8000;
const CLEANUP_DELAY = 30000;

function collectionValues(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return [...collection];
  if (Array.isArray(collection.contents)) return [...collection.contents];
  if (typeof collection.values === "function") {
    try { return [...collection.values()]; } catch (_error) { /* fall through */ }
  }
  try { return [...collection]; } catch (_error) { return []; }
}

function normalizeDc(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 60 ? number : null;
}

function escapeHtml(value) {
  const text = String(value ?? "");
  const escape = globalThis.foundry?.utils?.escapeHTML;
  if (typeof escape === "function") return escape(text);
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function localize(key, fallback = key) {
  return globalThis.game?.i18n?.localize?.(key) ?? fallback;
}

function format(key, data, fallback) {
  const i18n = globalThis.game?.i18n;
  if (typeof i18n?.format === "function") return i18n.format(key, data);
  return fallback;
}

function levelDcHelperContent() {
  const levels = getLevelDcOptions()
    .map((entry) => `<option value="${entry.level}">${escapeHtml(format("PF2EActionForge.DC.LevelHelper.LevelOption", entry, `Level ${entry.level} · DC ${entry.dc}`))}</option>`)
    .join("");
  const difficulties = getDifficultyOptions()
    .map((entry) => {
      const difficulty = localize(`PF2EActionForge.DC.LevelHelper.Difficulty.${entry.id}`, entry.id);
      const adjustment = entry.adjustment > 0 ? `+${entry.adjustment}` : String(entry.adjustment);
      const label = format("PF2EActionForge.DC.LevelHelper.DifficultyOption", { difficulty, adjustment }, `${difficulty} (${adjustment})`);
      return `<option value="${escapeHtml(entry.id)}"${entry.id === "standard" ? " selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");

  return `
    <fieldset class="af-gm-level-dc-helper">
      <legend>${escapeHtml(localize("PF2EActionForge.DC.LevelHelper.Title", "Level-based DC helper"))}</legend>
      <p>${escapeHtml(localize("PF2EActionForge.GMDC.LevelHelperHint", "Choose a level and difficulty instead of entering a DC manually."))}</p>
      <div class="af-gm-level-dc-grid">
        <label>
          <span>${escapeHtml(localize("PF2EActionForge.DC.LevelHelper.Level", "Level"))}</span>
          <select name="levelDcLevel">
            <option value="">${escapeHtml(localize("PF2EActionForge.DC.LevelHelper.LevelPlaceholder", "Choose level"))}</option>
            ${levels}
          </select>
        </label>
        <label>
          <span>${escapeHtml(localize("PF2EActionForge.DC.LevelHelper.DifficultyLabel", "Difficulty"))}</span>
          <select name="levelDcDifficulty">${difficulties}</select>
        </label>
      </div>
      <small>${escapeHtml(localize("PF2EActionForge.GMDC.LevelHelperSubmitHint", "If no manual DC is entered, Action Forge calculates the DC from these selections when you confirm."))}</small>
    </fieldset>`;
}

function resolveResponseDc(response) {
  const manual = normalizeDc(response?.dc);
  if (manual !== null) return { dc: manual, source: "manual" };
  const calculated = calculateLevelDc(response?.levelDcLevel, response?.levelDcDifficulty ?? "standard");
  if (!calculated) return null;
  return { dc: calculated.dc, source: "level", calculation: calculated };
}

function messageUserId(message, hookUserId = null) {
  return hookUserId ?? message?.author?.id ?? message?.user?.id ?? message?.user ?? null;
}

/**
 * Requests a GM-adjudicated DC from one deterministic active GM.
 *
 * Player -> GM transport deliberately uses a transient, whispered ChatMessage as
 * the primary request/response carrier. ChatMessage document replication is a
 * server-backed path every normal player already uses in play and does not depend
 * on remote-dialog query permissions. The request message is hidden by Action
 * Forge and removed by the GM after the response has had time to replicate.
 *
 * Module sockets and User#query remain bounded fallbacks only.
 */
export class GmDcHandoff {
  #pending = new Map();
  #handled = new Map();
  #initialized = false;
  #queryRegistered = false;

  registerQueryHandler() {
    gmDcDebugLog.add("query.register.attempt", { alreadyRegistered: this.#queryRegistered, hasConfigQueries: Boolean(globalThis.CONFIG?.queries) });
    if (this.#queryRegistered) return;
    const queries = globalThis.CONFIG?.queries;
    if (!queries) return;
    this.#queryRegistered = true;
    queries[QUERY_NAME] = async (queryData = {}) => {
      gmDcDebugLog.add("query.received", { requestId: queryData?.requestId ?? null, requesterId: queryData?.requesterId ?? null, brokerId: queryData?.brokerId ?? null });
      if (!globalThis.game?.user?.isGM) return { ok: false, reason: "not-gm", requestId: queryData.requestId ?? null };
      const requester = globalThis.game?.users?.get?.(queryData.requesterId)
        ?? collectionValues(globalThis.game?.users).find((user) => user?.id === queryData.requesterId);
      if (!requester?.active) return { ok: false, reason: "unknown-requester", requestId: queryData.requestId ?? null };
      return this.#promptOnce(queryData);
    };
  }

  initialize() {
    gmDcDebugLog.add("handoff.initialize", { alreadyInitialized: this.#initialized, hasSocket: Boolean(globalThis.game?.socket), hasHooks: Boolean(globalThis.Hooks?.on) });
    this.registerQueryHandler();
    if (this.#initialized) return;
    this.#initialized = true;

    if (globalThis.game?.socket) {
      globalThis.game.socket.on(SOCKET, (message) => {
        gmDcDebugLog.add("socket.event", { type: message?.type ?? null, requestId: message?.requestId ?? null, requesterId: message?.requesterId ?? null, brokerId: message?.brokerId ?? null, responderId: message?.responderId ?? null });
        return this.#onSocket(message);
      });
    }

    const Hooks = globalThis.Hooks;
    if (Hooks?.on) {
      Hooks.on("createChatMessage", (message, _options, userId) => {
        const envelope = message?.flags?.[MODULE_ID]?.[CHAT_FLAG];
        gmDcDebugLog.add("hook.createChatMessage", { messageId: message?.id ?? null, hookUserId: userId ?? null, authorId: message?.author?.id ?? message?.user?.id ?? message?.user ?? null, hasEnvelope: Boolean(envelope), requestId: envelope?.request?.requestId ?? null, requesterId: envelope?.request?.requesterId ?? null, brokerId: envelope?.request?.brokerId ?? null, hasResponse: Boolean(envelope?.response) });
        void this.onChatMessageCreated(message, userId);
      });
      Hooks.on("updateChatMessage", (message) => {
        const envelope = message?.flags?.[MODULE_ID]?.[CHAT_FLAG];
        gmDcDebugLog.add("hook.updateChatMessage", { messageId: message?.id ?? null, hasEnvelope: Boolean(envelope), requestId: envelope?.request?.requestId ?? null, hasResponse: Boolean(envelope?.response), responseOk: envelope?.response?.ok ?? null, responseReason: envelope?.response?.reason ?? null });
        this.onChatMessageUpdated(message);
      });
      const hide = (message, html) => this.hideInternalChatMessage(message, html);
      Hooks.on("renderChatMessageHTML", hide);
    }
  }

  getBrokers(users = globalThis.game?.users ?? []) {
    const activeGms = collectionValues(users).filter((user) => Boolean(user?.isGM && user?.active));
    const preferred = users?.activeGM ?? globalThis.game?.users?.activeGM ?? null;
    return activeGms.sort((a, b) => {
      if (preferred?.id && a.id === preferred.id) return -1;
      if (preferred?.id && b.id === preferred.id) return 1;
      return String(a.id ?? "").localeCompare(String(b.id ?? ""));
    });
  }

  getBroker(users = globalThis.game?.users ?? []) {
    return this.getBrokers(users)[0] ?? null;
  }

  isAvailable(users = globalThis.game?.users ?? []) {
    const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    if (globalThis.game?.user?.isGM) return typeof DialogV2?.input === "function";
    return Boolean(this.getBrokers(users).length && (
      typeof globalThis.ChatMessage?.create === "function"
      || globalThis.game?.socket
      || this.getBrokers(users).some((broker) => typeof broker?.query === "function")
    ));
  }

  createRequestId() {
    const randomId = globalThis.foundry?.utils?.randomID;
    if (typeof randomId === "function") return randomId(20);
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  #buildPayload({ definition, actor, target, statisticLabel, requestId, requesterId, brokerId = null }) {
    return {
      requesterId,
      brokerId,
      requestId,
      actionId: definition?.id ?? null,
      actionName: globalThis.game?.i18n?.localize?.(definition?.label) ?? definition?.id ?? "Action",
      actorName: actor?.name ?? "—",
      targetName: target?.name ?? target?.actor?.name ?? "—",
      statisticLabel: statisticLabel || "—"
    };
  }

  #buildDialogConfig(data = {}) {
    const registered = data.actionId ? actionRegistry.get(data.actionId) : null;
    const actionName = registered
      ? globalThis.game?.i18n?.localize?.(registered.label) ?? registered.id
      : data.actionName ?? data.actionId ?? "Action";
    const content = `
      <div class="af-gm-dc-query">
        <p>${escapeHtml(localize("PF2EActionForge.GMDC.RequestIntro", "A player action requires a secret DC."))}</p>
        <dl>
          <div><dt>${escapeHtml(localize("PF2EActionForge.GMDC.Action", "Action"))}</dt><dd>${escapeHtml(actionName)}</dd></div>
          <div><dt>${escapeHtml(localize("PF2EActionForge.GMDC.Actor", "Actor"))}</dt><dd>${escapeHtml(data.actorName ?? "—")}</dd></div>
          <div><dt>${escapeHtml(localize("PF2EActionForge.GMDC.Target", "Target"))}</dt><dd>${escapeHtml(data.targetName ?? "—")}</dd></div>
          <div><dt>${escapeHtml(localize("PF2EActionForge.GMDC.Statistic", "Statistic"))}</dt><dd>${escapeHtml(data.statisticLabel || "—")}</dd></div>
        </dl>
        <label class="af-gm-dc-query-input">
          <span>${escapeHtml(localize("PF2EActionForge.GMDC.DC", "DC"))}</span>
          <input name="dc" type="number" min="0" max="60" step="1" inputmode="numeric" autofocus />
        </label>
        <div class="af-gm-dc-or">${escapeHtml(localize("PF2EActionForge.GMDC.Or", "or"))}</div>
        ${levelDcHelperContent()}
      </div>`;

    return {
      window: { title: localize("PF2EActionForge.GMDC.Title", "Action Forge · DC Required") },
      content,
      ok: { label: localize("PF2EActionForge.GMDC.Approve", "Set DC & Roll") },
      rejectClose: false,
      modal: true
    };
  }

  #resultFromResponse(response, payload, gmId) {
    if (!response) return { ok: false, reason: "rejected", requestId: payload.requestId, gmId };
    const resolved = resolveResponseDc(response);
    if (!resolved) return { ok: false, reason: "invalid-dc", requestId: payload.requestId, gmId };
    return {
      ok: true,
      dc: resolved.dc,
      dcSource: resolved.source,
      requestId: payload.requestId,
      gmId
    };
  }

  async request({ definition, actor, target = null, statisticLabel = "", requestId = null } = {}) {
    const requester = globalThis.game?.user;
    gmDcDebugLog.add("request.start", { requestId, actionId: definition?.id ?? null, actorName: actor?.name ?? null, targetName: target?.name ?? target?.actor?.name ?? null, statisticLabel });
    if (!requester) return { ok: false, reason: "no-user", requestId };

    const brokers = this.getBrokers();
    const broker = brokers[0] ?? null;
    gmDcDebugLog.add("request.broker-selected", { requestId, brokers: brokers.map((entry) => ({ id: entry?.id ?? null, name: entry?.name ?? null, active: Boolean(entry?.active) })), brokerId: broker?.id ?? null });
    if (!requester.isGM && !broker) return { ok: false, reason: "no-active-gm", requestId };

    const payload = this.#buildPayload({
      definition,
      actor,
      target,
      statisticLabel,
      requestId: requestId ?? this.createRequestId(),
      requesterId: requester.id,
      brokerId: broker?.id ?? requester.id
    });

    if (requester.isGM) {
      gmDcDebugLog.add("request.local-gm-prompt", { requestId: payload.requestId });
      return this.#prompt(payload);
    }

    // Primary path: a transient whispered ChatMessage. This is intentionally not
    // DialogV2.query: in real player sessions the latter can remain pending when
    // the caller lacks or loses QUERY_USER capability, which strands the workflow.
    gmDcDebugLog.add("transport.chat.start", { requestId: payload.requestId, brokerId: broker.id });
    const chatResult = await this.#requestViaChat(payload, broker);
    gmDcDebugLog.add("transport.chat.result", { requestId: payload.requestId, brokerId: broker.id, result: chatResult });
    if (chatResult?.ok || ["rejected", "invalid-dc"].includes(chatResult?.reason)) return chatResult;
    console.warn(`PF2E Action Forge | GM DC chat handoff failed via ${broker.id}; trying bounded fallbacks`, chatResult);

    // First fallback: module socket with a short acknowledgement window.
    if (globalThis.game?.socket) {
      gmDcDebugLog.add("transport.socket.start", { requestId: payload.requestId, brokerId: broker.id });
      const socketResult = await this.#requestViaSocket(payload, broker);
      gmDcDebugLog.add("transport.socket.result", { requestId: payload.requestId, brokerId: broker.id, result: socketResult });
      if (socketResult?.ok || ["rejected", "invalid-dc"].includes(socketResult?.reason)) return socketResult;
      console.warn(`PF2E Action Forge | GM DC socket fallback failed via ${broker.id}`, socketResult);
    }

    // Last fallback: the module's registered User#query, always with a short
    // timeout so a permission/configuration mismatch cannot leave the player UI
    // stuck indefinitely.
    for (const candidate of brokers.filter((entry) => typeof entry?.query === "function")) {
      try {
        gmDcDebugLog.add("transport.query.start", { requestId: payload.requestId, brokerId: candidate?.id ?? null, queryName: QUERY_NAME });
        const result = await candidate.query(QUERY_NAME, payload, { timeout: QUERY_TIMEOUT });
        gmDcDebugLog.add("transport.query.result", { requestId: payload.requestId, brokerId: candidate?.id ?? null, result });
        if (result) return { ...result, gmId: result.gmId ?? candidate.id };
      } catch (error) {
        gmDcDebugLog.add("transport.query.error", { requestId: payload.requestId, brokerId: candidate?.id ?? null, error });
        console.warn(`PF2E Action Forge | GM DC query fallback failed via ${candidate?.id ?? "?"}`, error);
      }
    }

    const finalFailure = { ok: false, reason: chatResult?.reason ?? "handoff-failed", requestId: payload.requestId, gmId: broker.id };
    gmDcDebugLog.add("request.failed", finalFailure);
    return finalFailure;
  }

  async #requestViaChat(payload, broker) {
    const ChatMessage = globalThis.ChatMessage;
    gmDcDebugLog.add("chat.prepare", { requestId: payload.requestId, brokerId: broker?.id ?? null, hasChatMessageCreate: typeof ChatMessage?.create === "function" });
    if (typeof ChatMessage?.create !== "function" || !broker?.id) {
      return { ok: false, reason: "chat-unavailable", requestId: payload.requestId, gmId: broker?.id ?? null };
    }

    const promise = new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(payload.requestId);
        resolve({ ok: false, reason: "chat-timeout", requestId: payload.requestId, gmId: broker.id });
      }, REQUEST_TIMEOUT);
      this.#pending.set(payload.requestId, { resolve, timeout, brokerId: broker.id, transport: "chat" });
      gmDcDebugLog.add("pending.set", { requestId: payload.requestId, brokerId: broker.id, transport: "chat" });
    });

    try {
      const speaker = typeof ChatMessage.getSpeaker === "function"
        ? ChatMessage.getSpeaker({ alias: "PF2E Action Forge" })
        : { alias: "PF2E Action Forge" };
      gmDcDebugLog.add("chat.create.begin", { requestId: payload.requestId, whisper: [...new Set([payload.requesterId, broker.id])] });
      const message = await ChatMessage.create({
        speaker,
        whisper: [...new Set([payload.requesterId, broker.id])],
        content: `<div class="pf2e-action-forge-gm-dc-transport" data-request-id="${escapeHtml(payload.requestId)}" hidden></div>`,
        flags: {
          [MODULE_ID]: {
            [CHAT_FLAG]: {
              request: payload,
              response: null
            }
          }
        }
      });
      const pending = this.#pending.get(payload.requestId);
      if (pending) pending.messageId = message?.id ?? null;
      gmDcDebugLog.add("chat.create.success", { requestId: payload.requestId, messageId: message?.id ?? null, brokerId: broker.id });
    } catch (error) {
      gmDcDebugLog.add("chat.create.error", { requestId: payload.requestId, brokerId: broker.id, error });
      const pending = this.#pending.get(payload.requestId);
      if (pending) clearTimeout(pending.timeout);
      this.#pending.delete(payload.requestId);
      console.warn("PF2E Action Forge | Could not create GM DC transport message", error);
      return { ok: false, reason: "chat-error", requestId: payload.requestId, gmId: broker.id };
    }

    return promise;
  }

  async onChatMessageCreated(message, hookUserId = null) {
    const envelope = message?.flags?.[MODULE_ID]?.[CHAT_FLAG];
    const request = envelope?.request;
    gmDcDebugLog.add("chat.created.inspect", {
      messageId: message?.id ?? null,
      hookUserId,
      messageUserId: messageUserId(message, hookUserId),
      hasEnvelope: Boolean(envelope),
      hasRequest: Boolean(request),
      hasResponse: Boolean(envelope?.response),
      requestId: request?.requestId ?? null,
      requesterId: request?.requesterId ?? null,
      brokerId: request?.brokerId ?? null,
      currentUserId: globalThis.game?.user?.id ?? null,
      currentUserIsGM: Boolean(globalThis.game?.user?.isGM)
    });
    if (!request) { gmDcDebugLog.add("chat.created.drop", { reason: "no-request", messageId: message?.id ?? null }); return; }
    if (envelope?.response) { gmDcDebugLog.add("chat.created.drop", { reason: "already-has-response", requestId: request.requestId }); return; }
    if (!globalThis.game?.user?.isGM) { gmDcDebugLog.add("chat.created.drop", { reason: "current-user-not-gm", requestId: request.requestId }); return; }
    if (request.brokerId !== globalThis.game.user.id) { gmDcDebugLog.add("chat.created.drop", { reason: "wrong-broker", requestId: request.requestId, expectedBrokerId: request.brokerId, currentUserId: globalThis.game.user.id }); return; }
    const actualMessageUserId = messageUserId(message, hookUserId);
    if (actualMessageUserId !== request.requesterId) { gmDcDebugLog.add("chat.created.drop", { reason: "author-mismatch", requestId: request.requestId, actualMessageUserId, requesterId: request.requesterId }); return; }

    const requester = globalThis.game?.users?.get?.(request.requesterId)
      ?? collectionValues(globalThis.game?.users).find((user) => user?.id === request.requesterId);
    if (!requester?.active) { gmDcDebugLog.add("chat.created.drop", { reason: "requester-inactive", requestId: request.requestId, requesterId: request.requesterId }); return; }

    gmDcDebugLog.add("chat.created.accept", { requestId: request.requestId, messageId: message?.id ?? null });
    const result = await this.#promptOnce(request);
    gmDcDebugLog.add("chat.prompt.result", { requestId: request.requestId, result });
    try {
      gmDcDebugLog.add("chat.response.update.begin", { requestId: request.requestId, messageId: message?.id ?? null, result });
      await message.update({
        [`flags.${MODULE_ID}.${CHAT_FLAG}.response`]: result
      });
      gmDcDebugLog.add("chat.response.update.success", { requestId: request.requestId, messageId: message?.id ?? null });
    } catch (error) {
      gmDcDebugLog.add("chat.response.update.error", { requestId: request.requestId, messageId: message?.id ?? null, error });
      console.error("PF2E Action Forge | Could not return GM DC through transport message", error);
      if (globalThis.game?.socket) {
        globalThis.game.socket.emit(SOCKET, {
          type: "gm-dc-response",
          requestId: request.requestId,
          requesterId: request.requesterId,
          responderId: globalThis.game.user.id,
          result
        });
      }
    }

    // The message is an internal transport document, not chat content. Keep it
    // briefly so the response can replicate to the requester, then remove it.
    if (typeof message.delete === "function") {
      const cleanupTimer = setTimeout(() => {
        void Promise.resolve(message.delete()).catch((error) => console.debug("PF2E Action Forge | Internal GM DC message cleanup skipped", error));
      }, CLEANUP_DELAY);
      cleanupTimer?.unref?.();
    }
  }

  onChatMessageUpdated(message) {
    const envelope = message?.flags?.[MODULE_ID]?.[CHAT_FLAG];
    const request = envelope?.request;
    const response = envelope?.response;
    gmDcDebugLog.add("chat.updated.inspect", { messageId: message?.id ?? null, hasRequest: Boolean(request), hasResponse: Boolean(response), requestId: request?.requestId ?? null, requesterId: request?.requesterId ?? null, currentUserId: globalThis.game?.user?.id ?? null, brokerId: request?.brokerId ?? null });
    if (!request || !response) { gmDcDebugLog.add("chat.updated.drop", { reason: "missing-request-or-response", messageId: message?.id ?? null }); return; }
    if (request.requesterId !== globalThis.game?.user?.id) { gmDcDebugLog.add("chat.updated.drop", { reason: "not-requester", requestId: request.requestId }); return; }

    const pending = this.#pending.get(request.requestId);
    if (!pending) { gmDcDebugLog.add("chat.updated.drop", { reason: "no-pending", requestId: request.requestId }); return; }
    if (pending.brokerId !== request.brokerId) { gmDcDebugLog.add("chat.updated.drop", { reason: "broker-mismatch", requestId: request.requestId, pendingBrokerId: pending.brokerId, requestBrokerId: request.brokerId }); return; }
    clearTimeout(pending.timeout);
    if (pending.ackTimeout) clearTimeout(pending.ackTimeout);
    this.#pending.delete(request.requestId);
    gmDcDebugLog.add("pending.resolve.chat", { requestId: request.requestId, brokerId: request.brokerId, response });
    pending.resolve(response);
  }

  hideInternalChatMessage(message, html) {
    if (!message?.flags?.[MODULE_ID]?.[CHAT_FLAG]) return;
    const root = globalThis.HTMLElement && html instanceof HTMLElement ? html : html?.[0] ?? null;
    if (root) root.style.display = "none";
  }

  async #requestViaSocket(payload, broker) {
    if (!globalThis.game?.socket || !broker?.id) {
      return { ok: false, reason: "socket-unavailable", requestId: payload.requestId, gmId: broker?.id ?? null };
    }

    const promise = new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(payload.requestId);
        resolve({ ok: false, reason: "timeout", requestId: payload.requestId, gmId: broker.id });
      }, REQUEST_TIMEOUT);
      const ackTimeout = setTimeout(() => {
        const pending = this.#pending.get(payload.requestId);
        if (!pending || pending.acknowledged) return;
        clearTimeout(pending.timeout);
        this.#pending.delete(payload.requestId);
        resolve({ ok: false, reason: "socket-no-ack", requestId: payload.requestId, gmId: broker.id });
      }, SOCKET_ACK_TIMEOUT);
      this.#pending.set(payload.requestId, { resolve, timeout, ackTimeout, brokerId: broker.id, acknowledged: false, transport: "socket" });
      gmDcDebugLog.add("pending.set", { requestId: payload.requestId, brokerId: broker.id, transport: "socket" });
    });

    try {
      gmDcDebugLog.add("socket.emit.request", { requestId: payload.requestId, brokerId: broker.id, requesterId: payload.requesterId });
      globalThis.game.socket.emit(SOCKET, { type: "gm-dc-request", ...payload });
    } catch (error) {
      const pending = this.#pending.get(payload.requestId);
      if (pending) {
        clearTimeout(pending.timeout);
        clearTimeout(pending.ackTimeout);
      }
      this.#pending.delete(payload.requestId);
      console.warn("PF2E Action Forge | Could not emit GM DC socket request", error);
      return { ok: false, reason: "socket-error", requestId: payload.requestId, gmId: broker.id };
    }

    return promise;
  }

  async #promptOnce(data = {}) {
    const key = `${data.requesterId ?? "?"}:${data.requestId ?? "?"}`;

    // Foundry can surface the same replicated ChatMessage creation more than once
    // on a client (for example through concurrent document/hook delivery paths).
    // A duplicate delivery is not a duplicate player request. All deliveries for
    // the same requester/request id must join the same in-flight adjudication so
    // exactly one GM dialog opens and every transport receives the same result.
    const existing = this.#handled.get(key);
    if (existing) {
      gmDcDebugLog.add("prompt.once.join", { key, requestId: data.requestId ?? null, requesterId: data.requesterId ?? null });
      return existing;
    }

    gmDcDebugLog.add("prompt.once.start", { key, requestId: data.requestId ?? null, requesterId: data.requesterId ?? null });

    const adjudication = Promise.resolve().then(() => this.#prompt(data));
    this.#handled.set(key, adjudication);

    try {
      return await adjudication;
    } finally {
      // Retain the resolved promise briefly. A late socket/query fallback then
      // receives the already chosen DC instead of reopening the dialog or turning
      // a valid request into a synthetic "duplicate-request" failure.
      const releaseTimer = setTimeout(() => {
        if (this.#handled.get(key) === adjudication) this.#handled.delete(key);
      }, CLEANUP_DELAY);
      releaseTimer?.unref?.();
    }
  }

  async #prompt(data = {}) {
    const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    gmDcDebugLog.add("prompt.prepare", { requestId: data.requestId ?? null, requesterId: data.requesterId ?? null, brokerId: data.brokerId ?? null, dialogInputAvailable: typeof DialogV2?.input === "function" });
    if (typeof DialogV2?.input !== "function") {
      return { ok: false, reason: "dialog-unavailable", requestId: data.requestId ?? null, gmId: globalThis.game?.user?.id ?? null };
    }

    try {
      gmDcDebugLog.add("prompt.open", { requestId: data.requestId ?? null });
      const response = await DialogV2.input(this.#buildDialogConfig(data));
      gmDcDebugLog.add("prompt.closed", { requestId: data.requestId ?? null, hadResponse: Boolean(response), responseKeys: response && typeof response === "object" ? Object.keys(response) : [] });
      const result = this.#resultFromResponse(response, data, globalThis.game?.user?.id ?? null);
      gmDcDebugLog.add("prompt.resolved", { requestId: data.requestId ?? null, result });
      return result;
    } catch (error) {
      gmDcDebugLog.add("prompt.error", { requestId: data.requestId ?? null, error });
      console.warn("PF2E Action Forge | GM DC dialog failed", error);
      return { ok: false, reason: "dialog-error", requestId: data.requestId ?? null, gmId: globalThis.game?.user?.id ?? null };
    }
  }

  async #onSocket(message) {
    if (!message || typeof message !== "object") return;

    if (message.type === "gm-dc-ack" && message.requesterId === globalThis.game?.user?.id) {
      const pending = this.#pending.get(message.requestId);
      if (!pending || message.responderId !== pending.brokerId) return;
      const responder = globalThis.game?.users?.get?.(message.responderId)
        ?? collectionValues(globalThis.game?.users).find((user) => user?.id === message.responderId);
      if (!responder?.isGM) return;
      pending.acknowledged = true;
      gmDcDebugLog.add("socket.ack.accept", { requestId: message.requestId, responderId: message.responderId });
      clearTimeout(pending.ackTimeout);
      return;
    }

    if (message.type === "gm-dc-response" && message.requesterId === globalThis.game?.user?.id) {
      const pending = this.#pending.get(message.requestId);
      if (!pending || message.responderId !== pending.brokerId) return;
      const responder = globalThis.game?.users?.get?.(message.responderId)
        ?? collectionValues(globalThis.game?.users).find((user) => user?.id === message.responderId);
      if (!responder?.isGM) return;
      clearTimeout(pending.timeout);
      if (pending.ackTimeout) clearTimeout(pending.ackTimeout);
      this.#pending.delete(message.requestId);
      const socketResponse = message.result ?? { ok: false, reason: "empty-response", requestId: message.requestId, gmId: message.responderId };
      gmDcDebugLog.add("pending.resolve.socket", { requestId: message.requestId, responderId: message.responderId, response: socketResponse });
      pending.resolve(socketResponse);
      return;
    }

    if (message.type !== "gm-dc-request") return;
    if (!globalThis.game?.user?.isGM || message.brokerId !== globalThis.game.user.id) return;
    const requester = globalThis.game?.users?.get?.(message.requesterId)
      ?? collectionValues(globalThis.game?.users).find((user) => user?.id === message.requesterId);
    if (!requester?.active) return;

    const responderId = globalThis.game.user.id;
    gmDcDebugLog.add("socket.request.accept", { requestId: message.requestId, requesterId: message.requesterId, responderId });
    globalThis.game.socket.emit(SOCKET, {
      type: "gm-dc-ack",
      requestId: message.requestId,
      requesterId: message.requesterId,
      responderId
    });

    const result = await this.#promptOnce(message);
    gmDcDebugLog.add("socket.response.emit", { requestId: message.requestId, requesterId: message.requesterId, responderId, result });
    globalThis.game.socket.emit(SOCKET, {
      type: "gm-dc-response",
      requestId: message.requestId,
      requesterId: message.requesterId,
      responderId,
      result: { ...result, gmId: responderId }
    });
  }
}

export { normalizeDc, resolveResponseDc, QUERY_NAME as GM_DC_QUERY_NAME, CHAT_FLAG as GM_DC_CHAT_FLAG };
export const gmDcHandoff = new GmDcHandoff();
