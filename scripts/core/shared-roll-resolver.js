import { canUserActWith } from "./actor-resolver.js";
import { resolveActorDefenseDc } from "./dc-resolver.js";
import { MODULE_ID } from "./action-transaction.js";
import { targetPickerService } from "./target-picker-service.js";
import { visibilityEngine } from "./visibility-engine.js";
import { criticalForgeIntegration } from "./critical-forge-integration.js";

const REQUEST_TIMEOUT = 10000;
const QUERY_NAME = `${MODULE_ID}.resolveSharedRoll`;
const OUTCOMES = Object.freeze(["criticalFailure", "failure", "success", "criticalSuccess"]);

function collectionValues(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return [...collection];
  if (typeof collection.values === "function") {
    try { return [...collection.values()]; } catch (_error) { /* fall through */ }
  }
  try { return [...collection]; } catch (_error) { return []; }
}

function normalizeTotal(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= -100 && number <= 300 ? number : null;
}

function normalizeDieResult(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 20 ? number : null;
}

function getD20Result(roll) {
  const direct = normalizeDieResult(roll?.dice?.find?.((die) => Number(die?.faces) === 20)?.total);
  if (direct !== null) return direct;

  for (const die of roll?.dice ?? []) {
    if (Number(die?.faces) !== 20) continue;
    const active = (die.results ?? []).find((result) => result?.active !== false && result?.discarded !== true);
    const value = normalizeDieResult(active?.result);
    if (value !== null) return value;
  }

  for (const term of roll?.terms ?? []) {
    if (Number(term?.faces) !== 20) continue;
    const active = (term.results ?? []).find((result) => result?.active !== false && result?.discarded !== true);
    const value = normalizeDieResult(active?.result ?? term?.total);
    if (value !== null) return value;
  }
  return null;
}

/** Standard PF2e degree-of-success comparison, including natural 20 / natural 1. */
export function degreeOfSuccess(total, dc, dieResult = null) {
  const check = normalizeTotal(total);
  const target = Number(dc);
  if (check === null || !Number.isFinite(target)) return "unknown";

  let index;
  if (check >= target + 10) index = 3;
  else if (check >= target) index = 2;
  else if (check <= target - 10) index = 0;
  else index = 1;

  if (dieResult === 20) index = Math.min(3, index + 1);
  else if (dieResult === 1) index = Math.max(0, index - 1);
  return OUTCOMES[index];
}

export function snapshotSharedRoll(roll) {
  const total = normalizeTotal(roll?.total);
  if (total === null) return null;
  return Object.freeze({ total, dieResult: getD20Result(roll) });
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

/**
 * Resolves one immutable PF2e check against several target defenses.
 *
 * The actual target DC lookup happens on a GM client. The requesting player
 * receives only target names and outcomes when the action's visibility profile
 * permits those outcomes. Numeric defenses never cross the broker boundary.
 */
export class SharedRollResolver {
  #queryRegistered = false;
  #processedMessages = new Set();

  registerQueryHandler() {
    if (this.#queryRegistered) return;
    const queries = globalThis.CONFIG?.queries;
    if (!queries) return;
    this.#queryRegistered = true;
    queries[QUERY_NAME] = async (queryData = {}) => {
      if (!globalThis.game?.user?.isGM) return { ok: false, reason: "not-gm" };
      try {
        return await this.#process(queryData);
      } catch (error) {
        console.error("PF2E Action Forge | GM shared-roll resolution failed", error);
        return { ok: false, reason: "broker-error" };
      }
    };
  }

  getBrokers(users = globalThis.game?.users ?? []) {
    const values = collectionValues(users).filter((user) => Boolean(user?.isGM && user?.active));
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

  isAvailable(users = globalThis.game?.users ?? []) {
    if (globalThis.game?.user?.isGM) return true;
    return this.getBrokers(users).some((broker) => typeof broker?.query === "function");
  }

  async request({ definition, sourceActor, targets = [], roll, rollMessageId = null } = {}) {
    const requester = globalThis.game?.user;
    if (!requester) return { ok: false, reason: "no-user" };
    if (!definition?.execution?.sharedRoll) return { ok: false, reason: "not-shared-roll" };

    const snapshot = snapshotSharedRoll(roll);
    if (!snapshot) return { ok: false, reason: "invalid-roll" };

    const payload = {
      requesterId: requester.id,
      actionId: definition.id,
      sourceActorUuid: sourceActor?.uuid ?? null,
      targets: targets.map((entry) => ({
        actorUuid: entry?.actorUuid ?? entry?.actor?.uuid ?? entry?.token?.actor?.uuid ?? null,
        tokenUuid: entry?.tokenUuid ?? entry?.token?.document?.uuid ?? entry?.token?.uuid ?? null,
        source: entry?.source ?? null
      })).filter((entry) => entry.actorUuid),
      roll: snapshot,
      rollMessageId: rollMessageId ?? null
    };

    if (payload.targets.length === 0) return { ok: false, reason: "no-targets" };

    if (requester.isGM) return this.#process(payload);

    const brokers = this.getBrokers();
    if (brokers.length === 0) return { ok: false, reason: "no-active-gm" };

    const queryBrokers = brokers.filter((broker) => typeof broker?.query === "function");
    for (const broker of queryBrokers) {
      try {
        const result = await broker.query(QUERY_NAME, payload, { timeout: REQUEST_TIMEOUT });
        if (result) return result;
      } catch (error) {
        console.warn(`PF2E Action Forge | Shared-roll query failed via GM ${broker?.id ?? "?"}`, error);
      }
    }
    return { ok: false, reason: queryBrokers.length > 0 ? "query-failed" : "query-unavailable" };
  }

  async #process(payload = {}) {
    const requester = globalThis.game?.users?.get?.(payload.requesterId)
      ?? collectionValues(globalThis.game?.users).find((user) => user?.id === payload.requesterId)
      ?? (globalThis.game?.user?.id === payload.requesterId ? globalThis.game.user : null);
    if (!requester) return { ok: false, reason: "unknown-requester" };

    const { actionRegistry } = await import("./action-registry.js");
    const definition = actionRegistry.get(payload.actionId);
    if (!definition?.execution?.sharedRoll) return { ok: false, reason: "unknown-action" };
    if (definition?.dc?.strategy !== "target-defense" || !definition?.dc?.defense) {
      return { ok: false, reason: "unsupported-dc" };
    }

    let snapshot = {
      total: normalizeTotal(payload?.roll?.total),
      dieResult: normalizeDieResult(payload?.roll?.dieResult)
    };
    if (snapshot.total === null) return { ok: false, reason: "invalid-roll" };

    const sourceActor = await this.#resolveActor(payload.sourceActorUuid);
    if (!sourceActor) return { ok: false, reason: "missing-source" };
    if (!canUserActWith(sourceActor, requester)) return { ok: false, reason: "source-not-owned" };

    // A non-GM request must be tied to the actual PF2e ChatMessage generated by
    // the check. This prevents a client from repeatedly submitting arbitrary
    // totals to probe hidden target defenses. The broker uses the message roll
    // as its authoritative snapshot and accepts each message only once.
    if (!requester.isGM) {
      const verified = this.#verifyRollMessage({
        messageId: payload.rollMessageId,
        requester,
        definition,
        sourceActor,
        submitted: snapshot
      });
      if (!verified.ok) return verified;
      snapshot = verified.snapshot;
    }

    const requestedTargets = Array.isArray(payload.targets) ? payload.targets : [];
    const seen = new Set();
    const resolutions = [];
    for (const entry of requestedTargets) {
      if (!entry?.actorUuid || seen.has(entry.actorUuid)) continue;
      seen.add(entry.actorUuid);

      const targetActor = await this.#resolveActor(entry.actorUuid);
      if (!targetActor) return { ok: false, reason: "missing-target" };
      if (!(await this.#targetWasLegitimate(entry, targetActor, requester))) {
        return { ok: false, reason: "invalid-target" };
      }

      const dc = resolveActorDefenseDc(targetActor, definition.dc.defense);
      if (!Number.isFinite(dc)) return { ok: false, reason: "unresolved-defense" };

      resolutions.push({
        actorUuid: targetActor.uuid,
        tokenUuid: entry.tokenUuid ?? null,
        name: targetActor.name ?? "",
        dc,
        outcome: degreeOfSuccess(snapshot.total, dc, snapshot.dieResult),
        // GM-local document reference used only by optional integrations. It is
        // deliberately stripped from every player-facing response and chat flag.
        targetActor
      });
    }

    if (resolutions.length === 0) return { ok: false, reason: "no-targets" };
    if (!requester.isGM && payload.rollMessageId) {
      this.#processedMessages.add(`${requester.id}:${payload.rollMessageId}`);
    }
    await this.#createSummary({ definition, requester, sourceActor, snapshot, resolutions, rollMessageId: payload.rollMessageId });

    // Normal Action Forge checks are native PF2e messages and Critical Forge can
    // observe them directly. Shared rolls have no PF2e DC/degree until this GM
    // resolver finishes, so feed only the final critical categories into Critical
    // Forge's public automation API. Do not make the player wait on an optional
    // Critical Forge prompt or card draw.
    void criticalForgeIntegration.processSharedRoll({
      definition,
      sourceActor,
      snapshot,
      resolutions,
      rollMessageId: payload.rollMessageId
    }).catch((error) => {
      console.warn("PF2E Action Forge | Critical Forge integration failed", error);
    });

    const expose = visibilityEngine.canExposeOutcome(definition, requester);
    return {
      ok: true,
      targetCount: resolutions.length,
      hidden: !expose,
      results: expose
        ? resolutions.map(({ actorUuid, tokenUuid, name, outcome }) => ({ actorUuid, tokenUuid, name, outcome }))
        : []
    };
  }

  #verifyRollMessage({ messageId, requester, definition, sourceActor, submitted }) {
    if (!messageId) return { ok: false, reason: "missing-roll-message" };
    const key = `${requester.id}:${messageId}`;
    if (this.#processedMessages.has(key)) return { ok: false, reason: "roll-already-resolved" };

    const message = globalThis.game?.messages?.get?.(messageId)
      ?? collectionValues(globalThis.game?.messages).find((entry) => entry?.id === messageId)
      ?? null;
    if (!message) return { ok: false, reason: "missing-roll-message" };

    const authorId = message.author?.id ?? message.user?.id ?? message.userId ?? null;
    if (authorId && authorId !== requester.id) return { ok: false, reason: "roll-author-mismatch" };

    const speakerActorId = message.speaker?.actor ?? null;
    if (speakerActorId && sourceActor?.id && speakerActorId !== sourceActor.id) {
      return { ok: false, reason: "roll-source-mismatch" };
    }

    const rolls = collectionValues(message.rolls);
    const messageRoll = rolls.at(-1) ?? message.roll ?? null;
    const snapshot = snapshotSharedRoll(messageRoll);
    if (!snapshot) return { ok: false, reason: "invalid-roll-message" };
    if (snapshot.total !== submitted.total) return { ok: false, reason: "roll-mismatch" };
    if (snapshot.dieResult !== null && submitted.dieResult !== null && snapshot.dieResult !== submitted.dieResult) {
      return { ok: false, reason: "roll-mismatch" };
    }

    // PF2e normally records action roll options on the message. When explicit
    // action tags are present, reject a message that names a different action.
    const contextOptions = collectionValues(message.flags?.pf2e?.context?.options).map(String);
    const actionTags = contextOptions.filter((option) => option.startsWith("action:"));
    const acceptedActions = new Set([definition.id, definition.systemAction?.slug].filter(Boolean));
    if (actionTags.length > 0 && !actionTags.some((tag) => acceptedActions.has(tag.slice("action:".length)))) {
      return { ok: false, reason: "roll-action-mismatch" };
    }

    return { ok: true, snapshot };
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

  async #targetWasLegitimate(entry, targetActor, requester) {
    if (requester?.isGM) return true;

    if (entry.source === "picker") return targetPickerService.isEligibleTarget(targetActor, requester);

    if (entry.source === "canvas" && entry.tokenUuid) {
      let token = null;
      try { token = await globalThis.fromUuid?.(entry.tokenUuid); } catch (_error) { token = null; }
      if (!token) return false;
      const hidden = token.hidden ?? token.document?.hidden ?? false;
      const actorUuid = token.actor?.uuid ?? token.document?.actor?.uuid ?? null;
      return hidden !== true && (!actorUuid || actorUuid === targetActor.uuid);
    }

    if (entry.source === "sidebar") {
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

    return targetPickerService.isEligibleTarget(targetActor, requester);
  }

  async #createSummary({ definition, requester, sourceActor, snapshot, resolutions, rollMessageId }) {
    if (!globalThis.ChatMessage?.create) return;

    const actionName = localize(definition.label, definition.id);
    const outcomeMode = definition?.visibility?.outcome ?? "public";
    const targetRows = resolutions.map((entry) => {
      const outcome = localize(`PF2EActionForge.Roll.Outcome.${entry.outcome}`, entry.outcome);
      const dcText = outcomeMode !== "public"
        ? ` <small>${escapeHtml(localize("PF2EActionForge.SharedRoll.GMDc", "DC"))} ${escapeHtml(entry.dc)}</small>`
        : "";
      return `<li><strong>${escapeHtml(entry.name)}</strong><span>${escapeHtml(outcome)}${dcText}</span></li>`;
    }).join("");

    const content = `
      <div class="pf2e-action-forge-shared-roll">
        <header>
          <strong><i class="fa-solid fa-code-branch" aria-hidden="true"></i> ${escapeHtml(actionName)}</strong>
          <span>${escapeHtml(localize("PF2EActionForge.SharedRoll.Heading", "Shared roll"))}</span>
        </header>
        <p>${escapeHtml(localize("PF2EActionForge.SharedRoll.SummaryHint", "One check was compared against every selected target."))}</p>
        <ul>${targetRows}</ul>
      </div>`;

    const data = {
      speaker: globalThis.ChatMessage.getSpeaker?.({ actor: sourceActor }) ?? { alias: sourceActor?.name ?? "" },
      content,
      flags: {
        [MODULE_ID]: {
          sharedRoll: {
            actionId: definition.id,
            sourceActorUuid: sourceActor.uuid,
            rollMessageId: rollMessageId ?? null,
            targetCount: resolutions.length,
            total: snapshot.total
          }
        }
      }
    };

    if (outcomeMode !== "public") {
      const recipients = visibilityEngine.getRecipients(outcomeMode, { user: requester, users: globalThis.game?.users });
      if (recipients.length === 0) return;
      data.whisper = recipients;
      if (["blind", "gm"].includes(definition?.visibility?.roll)) data.blind = true;
    }

    try {
      await globalThis.ChatMessage.create(data);
    } catch (error) {
      console.warn("PF2E Action Forge | Failed to create shared-roll summary", error);
    }
  }
}

export { QUERY_NAME as SHARED_ROLL_QUERY_NAME };
export const sharedRollResolver = new SharedRollResolver();
