import { actionRegistry } from "./action-registry.js";
import { canUserActWith } from "./actor-resolver.js";
import { applicationEngine } from "./application-engine.js";
import { MODULE_ID } from "./action-transaction.js";
import { targetPickerService } from "./target-picker-service.js";

const SOCKET = `module.${MODULE_ID}`;
const REQUEST_TIMEOUT = 10000;
const QUERY_NAME = `${MODULE_ID}.applyActionResult`;

function resolveMessage(messageId) {
  return globalThis.game?.messages?.get?.(messageId) ?? null;
}

function getApplicationFlag(message) {
  return message?.flags?.[MODULE_ID]?.application ?? null;
}

export class ApplicationBroker {
  #pending = new Map();
  #processed = new Set();
  #initialized = false;
  #queryRegistered = false;

  registerQueryHandler() {
    if (this.#queryRegistered) return;
    const queries = globalThis.CONFIG?.queries;
    if (!queries) return;
    this.#queryRegistered = true;
    queries[QUERY_NAME] = async (queryData = {}) => {
      if (!globalThis.game?.user?.isGM) return { ok: false, reason: "not-gm" };
      try {
        return await this.#process({
          requesterId: queryData.requesterId,
          payload: queryData.payload
        });
      } catch (error) {
        console.error("PF2E Action Forge | GM application query failed", error);
        return { ok: false, reason: "broker-error" };
      }
    };
  }

  initialize() {
    this.registerQueryHandler();
    if (this.#initialized || !globalThis.game?.socket) return;
    this.#initialized = true;
    // Retain the direct socket listener as a compatibility fallback. Foundry v14
    // User queries are the primary transport for privileged application requests.
    game.socket.on(SOCKET, (message) => this.#onSocket(message));
  }

  getBroker(users = globalThis.game?.users ?? []) {
    const activeGM = users?.activeGM ?? globalThis.game?.users?.activeGM ?? null;
    if (activeGM?.isGM && activeGM?.active) return activeGM;
    return [...users]
      .filter((user) => Boolean(user?.isGM && user?.active))
      .sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")))[0] ?? null;
  }

  isAvailable() {
    return Boolean(globalThis.game?.user?.isGM || this.getBroker());
  }

  async request({ messageId, transactionId, effectId } = {}) {
    const requesterId = globalThis.game?.user?.id;
    if (!requesterId) return { ok: false, reason: "no-user" };

    const payload = { messageId, transactionId, effectId };
    if (globalThis.game?.user?.isGM) {
      return this.#process({ requesterId, payload });
    }

    // If the player already owns the target, apply locally after the same
    // validation path. Otherwise escalate only the write operation to the GM.
    const localMessage = resolveMessage(messageId);
    const localFlag = getApplicationFlag(localMessage);
    const localTarget = await this.#resolveActor(localFlag?.transaction?.targetActorUuid);
    const ownerLevel = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
    const ownsTarget = Boolean(localTarget && typeof localTarget.testUserPermission === "function"
      ? localTarget.testUserPermission(globalThis.game.user, ownerLevel)
      : localTarget?.isOwner);
    if (ownsTarget) return this.#process({ requesterId, payload });

    const broker = this.getBroker();
    if (!broker) return { ok: false, reason: "no-active-gm" };

    // Foundry v14 provides User#query specifically for request/response work
    // between clients. It is more reliable here than building a second response
    // protocol on top of raw module sockets, and it guarantees that the result
    // is routed back to the requesting player.
    if (typeof broker.query === "function") {
      try {
        const result = await broker.query(QUERY_NAME, { requesterId, payload }, { timeout: REQUEST_TIMEOUT });
        return result ?? { ok: false, reason: "empty-response" };
      } catch (error) {
        console.warn("PF2E Action Forge | GM application query failed", error);
        return { ok: false, reason: "query-failed" };
      }
    }

    // Compatibility fallback if a non-standard Foundry environment does not
    // expose User#query. The v14 release line should normally never reach this.
    if (!globalThis.game?.socket) return { ok: false, reason: "socket-unavailable" };
    const requestId = globalThis.foundry?.utils?.randomID?.(20) ?? `${Date.now()}-${Math.random()}`;
    const promise = new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(requestId);
        resolve({ ok: false, reason: "timeout" });
      }, REQUEST_TIMEOUT);
      this.#pending.set(requestId, { resolve, timeout });
    });

    game.socket.emit(SOCKET, {
      type: "apply-request",
      requestId,
      brokerId: broker.id,
      requesterId,
      payload
    });
    return promise;
  }

  async #onSocket(message) {
    if (!message || typeof message !== "object") return;

    if (message.type === "apply-response" && message.requesterId === globalThis.game?.user?.id) {
      const pending = this.#pending.get(message.requestId);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.#pending.delete(message.requestId);
      pending.resolve(message.result ?? { ok: false, reason: "empty-response" });
      return;
    }

    if (message.type !== "apply-request") return;
    if (!globalThis.game?.user?.isGM || message.brokerId !== globalThis.game.user.id) return;

    // A broker-side validation or PF2e API error must never strand the player
    // until the request timeout. Always convert unexpected exceptions into a
    // normal socket response so the UI can fail fast and report the problem.
    let result;
    try {
      result = await this.#process({ requesterId: message.requesterId, payload: message.payload });
    } catch (error) {
      console.error("PF2E Action Forge | GM application request failed", error);
      result = { ok: false, reason: "broker-error" };
    }

    game.socket.emit(SOCKET, {
      type: "apply-response",
      requestId: message.requestId,
      requesterId: message.requesterId,
      responderId: globalThis.game.user.id,
      result
    });
  }

  async #process({ requesterId, payload }) {
    const { messageId, transactionId, effectId } = payload ?? {};
    const requester = globalThis.game?.users?.get?.(requesterId) ?? [...(globalThis.game?.users ?? [])].find((u) => u.id === requesterId);
    if (!requester) return { ok: false, reason: "unknown-requester" };

    const message = resolveMessage(messageId);
    const flag = getApplicationFlag(message);
    if (!message || !flag) return { ok: false, reason: "missing-transaction" };
    if (flag.transaction?.id !== transactionId) return { ok: false, reason: "transaction-mismatch" };
    if (!requester.isGM && flag.transaction?.createdBy !== requesterId) {
      return { ok: false, reason: "requester-mismatch" };
    }

    const key = `${transactionId}:${effectId}`;
    const applied = flag.applied ?? {};
    if (this.#processed.has(key) || applied[effectId]) {
      return { ok: true, reason: "already-applied", alreadyApplied: true };
    }

    const definition = actionRegistry.get(flag.transaction.actionId);
    if (!definition) return { ok: false, reason: "unknown-action" };
    const effect = applicationEngine.getEffect(definition, flag.transaction.outcome, effectId);
    if (!effect) return { ok: false, reason: "invalid-effect" };

    const sourceActor = await this.#resolveActor(flag.transaction.sourceActorUuid);
    const targetActor = await this.#resolveActor(flag.transaction.targetActorUuid);
    const targetToken = await this.#resolveToken(flag.transaction.targetTokenUuid);
    if (!sourceActor || !targetActor) return { ok: false, reason: "missing-actor" };
    if (!canUserActWith(sourceActor, requester)) return { ok: false, reason: "source-not-owned" };
    if (!this.#targetWasLegitimate(flag.transaction, targetActor, requester)) {
      return { ok: false, reason: "invalid-target" };
    }

    this.#processed.add(key);
    const result = await applicationEngine.apply({
      effect,
      targetActor,
      sourceActor,
      targetToken,
      transactionId,
      transaction: flag.transaction
    });
    if (!result.ok) {
      this.#processed.delete(key);
      return result;
    }

    const nextApplied = {
      ...applied,
      [effectId]: {
        at: Date.now(),
        by: requesterId,
        changed: result.changed !== false,
        reason: result.reason ?? null,
        value: Number.isFinite(Number(result.value)) ? Number(result.value) : null,
        formula: result.formula ?? null,
        expiresAtWorldTime: Number.isFinite(Number(result.expiresAtWorldTime)) ? Number(result.expiresAtWorldTime) : null
      }
    };
    try {
      await message.update?.({ [`flags.${MODULE_ID}.application.applied`]: nextApplied });
    } catch (error) {
      console.warn("PF2E Action Forge | Application succeeded but chat flag update failed", error);
    }

    return { ok: true, effectId, application: result };
  }

  async #resolveActor(uuid) {
    if (!uuid || typeof globalThis.fromUuid !== "function") return null;
    try {
      const document = await fromUuid(uuid);
      if (!document) return null;
      if (document.documentName === "Actor" || document.constructor?.metadata?.name === "Actor") return document;
      if (document.actor) return document.actor;
      if (document.document?.actor) return document.document.actor;
      return null;
    } catch (_error) {
      return null;
    }
  }


  async #resolveToken(uuid) {
    if (!uuid || typeof globalThis.fromUuid !== "function") return null;
    try {
      const document = await fromUuid(uuid);
      if (!document) return null;
      if (document.documentName === "Token" || document.constructor?.metadata?.name === "Token") return document;
      if (document.document?.documentName === "Token") return document.document;
      return null;
    } catch (_error) {
      return null;
    }
  }

  #targetWasLegitimate(transaction, targetActor, requester) {
    if (requester?.isGM) return true;

    if (transaction.targetSource === "sidebar") {
      if (targetActor.visible === false) return false;
      const limited = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.LIMITED ?? 1;
      try {
        return typeof targetActor.testUserPermission === "function"
          ? targetActor.testUserPermission(requester, limited)
          : targetActor.visible !== false;
      } catch (_error) {
        return targetActor.visible !== false;
      }
    }

    if (transaction.targetSource === "canvas" && transaction.targetTokenUuid) {
      // Token targeting is a legitimate game action even when the player does not
      // own the target Actor. Hidden tokens are never accepted as player targets.
      const token = globalThis.fromUuidSync?.(transaction.targetTokenUuid);
      if (token) return token.hidden !== true;
      return true;
    }

    if (transaction.targetSource === "picker") {
      // Picker targets are deliberately revalidated against the same safe
      // eligibility rules used by the GM when the sanitized target list was built.
      return targetPickerService.isEligibleTarget(targetActor, requester);
    }

    return false;
  }
}

export const applicationBroker = new ApplicationBroker();
