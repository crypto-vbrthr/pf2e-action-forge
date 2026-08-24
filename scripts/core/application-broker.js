import { actionRegistry } from "./action-registry.js";
import { canUserActWith } from "./actor-resolver.js";
import { applicationEngine } from "./application-engine.js";
import { MODULE_ID } from "./action-transaction.js";
import { targetPickerService } from "./target-picker-service.js";
import { prerequisiteValidator } from "./prerequisite-validator.js";

const SOCKET = `module.${MODULE_ID}`;
const REQUEST_TIMEOUT = 10000;
const QUERY_NAME = `${MODULE_ID}.applyActionResult`;

function resolveMessage(messageId) {
  return globalThis.game?.messages?.get?.(messageId) ?? null;
}

function getApplicationFlag(message) {
  return message?.flags?.[MODULE_ID]?.application ?? null;
}

function escapeHtml(value) {
  const escape = globalThis.foundry?.utils?.escapeHTML;
  if (typeof escape === "function") return escape(String(value ?? ""));
  return String(value ?? "")
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
  return globalThis.game?.i18n?.format?.(key, data) ?? fallback;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.trunc(Number(seconds) || 0));
  if (total > 0 && total % 3600 === 0) {
    const hours = total / 3600;
    const key = hours === 1
      ? "PF2EActionForge.TreatWounds.Duration.Hour"
      : "PF2EActionForge.TreatWounds.Duration.Hours";
    return format(key, { value: hours }, `${hours} hour${hours === 1 ? "" : "s"}`);
  }
  if (total > 0 && total % 60 === 0) {
    const minutes = total / 60;
    const key = minutes === 1
      ? "PF2EActionForge.TreatWounds.Duration.Minute"
      : "PF2EActionForge.TreatWounds.Duration.Minutes";
    return format(key, { value: minutes }, `${minutes} minute${minutes === 1 ? "" : "s"}`);
  }
  const key = total === 1
    ? "PF2EActionForge.TreatWounds.Duration.Second"
    : "PF2EActionForge.TreatWounds.Duration.Seconds";
  return format(key, { value: total }, `${total} second${total === 1 ? "" : "s"}`);
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

  getBrokers(users = globalThis.game?.users ?? []) {
    const values = [...users].filter((user) => Boolean(user?.isGM && user?.active));
    const activeGM = users?.activeGM ?? globalThis.game?.users?.activeGM ?? null;
    return values.sort((a, b) => {
      if (activeGM?.id && a.id === activeGM.id) return -1;
      if (activeGM?.id && b.id === activeGM.id) return 1;
      return String(a.id ?? "").localeCompare(String(b.id ?? ""));
    });
  }

  getBroker(users = globalThis.game?.users ?? []) {
    return this.getBrokers(users)[0] ?? null;
  }

  isAvailable() {
    return Boolean(globalThis.game?.user?.isGM || this.getBroker());
  }

  async request({ messageId, transactionId, effectId } = {}) {
    const requesterId = globalThis.game?.user?.id;
    if (!requesterId) return { ok: false, reason: "no-user" };

    const payload = { messageId, transactionId, effectId };
    if (globalThis.game?.user?.isGM) {
      try {
        return await this.#process({ requesterId, payload });
      } catch (error) {
        console.error("PF2E Action Forge | Local GM application failed", error);
        return { ok: false, reason: "broker-error" };
      }
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
    if (ownsTarget) {
      try {
        return await this.#process({ requesterId, payload });
      } catch (error) {
        console.error("PF2E Action Forge | Local owned-target application failed", error);
        return { ok: false, reason: "broker-error" };
      }
    }

    const brokers = this.getBrokers();
    if (brokers.length === 0) return { ok: false, reason: "no-active-gm" };

    // Foundry v14 provides User#query specifically for request/response work
    // between clients. Prefer the active GM, but if that client disconnects while
    // the request is in flight, retry with the next deterministic active GM. The
    // broker's transaction/effect idempotence makes this safe even if a response
    // is lost after the first GM completed the write.
    const queryBrokers = brokers.filter((broker) => typeof broker?.query === "function");
    for (const broker of queryBrokers) {
      try {
        const result = await broker.query(QUERY_NAME, { requesterId, payload }, { timeout: REQUEST_TIMEOUT });
        if (result) return result;
      } catch (error) {
        console.warn(`PF2E Action Forge | GM application query failed via ${broker?.id ?? "?"}`, error);
      }
    }
    if (queryBrokers.length > 0) return { ok: false, reason: "query-failed" };

    // Compatibility fallback if a non-standard Foundry environment does not
    // expose User#query. The v14 release line should normally never reach this.
    const broker = brokers[0];
    if (!globalThis.game?.socket) return { ok: false, reason: "query-failed" };
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

    // Privileged writes never trust a client-side prerequisite check. Re-run
    // the same declarative validator against authoritative source/target Actors
    // before the first mutation in a transaction. Once one effect has applied,
    // later effects belong to that already-authorized resolution and must not be
    // invalidated merely because the first effect changed HP or conditions.
    if (Object.keys(applied).length === 0) {
      const prerequisiteState = await prerequisiteValidator.validate(definition, {
        actor: sourceActor,
        targetState: { targets: [{ actor: targetActor, actorUuid: targetActor.uuid }] },
        statistic: flag.transaction.statistic ?? null,
        resolveTargets: false,
        unknownAsFailure: true
      });
      if (!prerequisiteState.ok) {
        const failure = prerequisiteState.hardFailures[0] ?? prerequisiteState.unresolved[0] ?? null;
        return { ok: false, reason: "prerequisite-failed", prerequisiteMessage: failure?.message ?? null };
      }
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
        appliedValue: Number.isFinite(Number(result.appliedValue)) ? Number(result.appliedValue) : null,
        formula: result.formula ?? null,
        expiresAtWorldTime: Number.isFinite(Number(result.expiresAtWorldTime)) ? Number(result.expiresAtWorldTime) : null
      }
    };
    try {
      await message.update?.({ [`flags.${MODULE_ID}.application.applied`]: nextApplied });
    } catch (error) {
      console.warn("PF2E Action Forge | Application succeeded but chat flag update failed", error);
    }

    await this.#maybePostTreatWoundsSummary({
      message,
      transaction: flag.transaction,
      definition,
      sourceActor,
      targetActor
    });

    return { ok: true, effectId, application: result };
  }

  async #maybePostTreatWoundsSummary({ message, transaction, definition, sourceActor, targetActor }) {
    if (transaction?.actionId !== "treat-wounds") return;
    if (!["success", "criticalSuccess"].includes(transaction?.outcome)) return;
    if (!globalThis.ChatMessage?.create) return;

    const summaryKey = `${transaction.id}:treat-wounds-public-summary`;
    const currentFlag = getApplicationFlag(resolveMessage(message?.id) ?? message);
    if (currentFlag?.summary?.messageId || this.#processed.has(summaryKey)) return;

    // The immunity is intrinsic to Treat Wounds and is applied automatically.
    // Wait briefly for that automatic broker request if healing was clicked very
    // quickly after the result card appeared. This keeps the public summary truthful.
    let latestFlag = currentFlag;
    let immunity = null;
    for (const delay of [0, 100, 250]) {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      latestFlag = getApplicationFlag(resolveMessage(message?.id) ?? message) ?? latestFlag;
      immunity = applicationEngine.getActiveImmunity(targetActor, "treat-wounds", { sourceActor });
      if (latestFlag?.applied?.healing && immunity) break;
    }

    const healing = latestFlag?.applied?.healing;
    if (!healing || !immunity) return;
    if (latestFlag?.summary?.messageId || this.#processed.has(summaryKey)) return;

    const amount = Number.isFinite(Number(healing.appliedValue))
      ? Number(healing.appliedValue)
      : Number.isFinite(Number(healing.value)) ? Number(healing.value) : 0;
    const immunityEffect = applicationEngine.getEffect(definition, transaction.outcome, "treat-wounds-immunity");
    const durationSeconds = Number(immunityEffect?.durationSeconds)
      || Number(immunity.remainingSeconds)
      || 3600;
    const duration = formatDuration(durationSeconds);
    const outcomeText = localize(`PF2EActionForge.Roll.Outcome.${transaction.outcome}`, transaction.outcome);
    const title = localize("PF2EActionForge.TreatWounds.PublicSummary.Title", "Treat Wounds");
    const healedText = format(
      "PF2EActionForge.TreatWounds.PublicSummary.Healed",
      { source: transaction.sourceActorName, target: transaction.targetActorName, amount },
      `${transaction.sourceActorName} healed ${transaction.targetActorName} for ${amount} HP.`
    );
    const immunityText = format(
      "PF2EActionForge.TreatWounds.PublicSummary.Immunity",
      { target: transaction.targetActorName, duration },
      `${transaction.targetActorName} is now immune to Treat Wounds for ${duration}.`
    );

    const content = `
      <div class="pf2e-action-forge-application-card af-treat-wounds-summary">
        <header>
          <strong><i class="fa-solid fa-kit-medical" aria-hidden="true"></i> ${escapeHtml(title)}</strong>
          <span>${escapeHtml(outcomeText)}</span>
        </header>
        <p>${escapeHtml(healedText)}</p>
        <p class="af-application-note"><i class="fa-solid fa-shield-heart" aria-hidden="true"></i> ${escapeHtml(immunityText)}</p>
      </div>`;

    this.#processed.add(summaryKey);
    try {
      const speaker = globalThis.ChatMessage.getSpeaker?.({ alias: transaction.sourceActorName })
        ?? { alias: transaction.sourceActorName };
      const summaryMessage = await globalThis.ChatMessage.create({
        speaker,
        content,
        flags: {
          [MODULE_ID]: {
            treatWoundsSummary: {
              transactionId: transaction.id,
              sourceActorUuid: transaction.sourceActorUuid,
              targetActorUuid: transaction.targetActorUuid,
              outcome: transaction.outcome,
              amount,
              durationSeconds
            }
          }
        }
      });

      if (summaryMessage?.id) {
        await message?.update?.({
          [`flags.${MODULE_ID}.application.summary`]: {
            messageId: summaryMessage.id,
            at: Date.now()
          }
        });
      }
    } catch (error) {
      this.#processed.delete(summaryKey);
      console.warn("PF2E Action Forge | Failed to create Treat Wounds public summary", error);
    }
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
      // own the target Actor. Re-resolve the exact token at application time and
      // reject stale/deleted or hidden token UUIDs rather than trusting the client.
      const token = globalThis.fromUuidSync?.(transaction.targetTokenUuid);
      if (!token) return false;
      const hidden = token.hidden ?? token.document?.hidden ?? false;
      const actorUuid = token.actor?.uuid ?? token.document?.actor?.uuid ?? null;
      return hidden !== true && (!actorUuid || actorUuid === targetActor.uuid);
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
