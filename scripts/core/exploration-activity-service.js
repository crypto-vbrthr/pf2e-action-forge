import { canUserActWith } from "./actor-resolver.js";

const MODULE_ID = "pf2e-action-forge";
const FLAG_KEY = "explorationActivity";

function normalizeStoredActivity(value) {
  if (!value || typeof value !== "object") return null;
  const actionId = String(value.actionId ?? "").trim();
  if (!actionId) return null;
  return Object.freeze({
    actionId,
    statistic: value.statistic ? String(value.statistic) : null,
    targetActorUuid: value.targetActorUuid ? String(value.targetActorUuid) : null,
    targetActorName: value.targetActorName ? String(value.targetActorName) : null,
    targetSource: value.targetSource ? String(value.targetSource) : null,
    sourceUserId: value.sourceUserId ? String(value.sourceUserId) : null,
    startedAt: Number.isFinite(Number(value.startedAt)) ? Number(value.startedAt) : null
  });
}

/**
 * Persists one ongoing exploration activity on the acting Actor.
 *
 * Exploration activities are intentionally state, not immediate checks. The
 * stored descriptor contains only the configuration needed to remember what
 * the character is doing while the GM advances exploration time. Hidden DCs,
 * future secret checks and scene discoveries are not stored or exposed here.
 */
export class ExplorationActivityService {
  get(actor) {
    if (!actor) return null;
    let stored = null;
    try {
      stored = actor.getFlag?.(MODULE_ID, FLAG_KEY);
    } catch (_error) {
      stored = null;
    }
    if (!stored) stored = actor.flags?.[MODULE_ID]?.[FLAG_KEY] ?? null;
    return normalizeStoredActivity(stored);
  }

  async set(actor, definition, { statistic = null, targetEntry = null } = {}) {
    if (!actor || !definition || definition?.execution?.mode !== "exploration-activity") {
      return { ok: false, reason: "invalid-activity" };
    }
    if (!canUserActWith(actor, globalThis.game?.user)) {
      return { ok: false, reason: "not-owner" };
    }
    if (typeof actor.setFlag !== "function") {
      return { ok: false, reason: "unavailable" };
    }

    const value = {
      actionId: definition.id,
      statistic: statistic || null,
      targetActorUuid: targetEntry?.actor?.uuid ?? targetEntry?.actorUuid ?? null,
      targetActorName: targetEntry?.actor?.name ?? targetEntry?.name ?? null,
      targetSource: targetEntry?.source ?? null,
      sourceUserId: globalThis.game?.user?.id ?? null,
      startedAt: Date.now()
    };

    try {
      await actor.setFlag(MODULE_ID, FLAG_KEY, value);
      return { ok: true, activity: normalizeStoredActivity(value) };
    } catch (error) {
      console.error("PF2E Action Forge | Failed to store exploration activity", error);
      return { ok: false, reason: "update-failed", error };
    }
  }

  async clear(actor) {
    if (!actor) return { ok: false, reason: "no-actor" };
    if (!canUserActWith(actor, globalThis.game?.user)) {
      return { ok: false, reason: "not-owner" };
    }

    try {
      if (typeof actor.unsetFlag === "function") {
        await actor.unsetFlag(MODULE_ID, FLAG_KEY);
      } else if (typeof actor.setFlag === "function") {
        await actor.setFlag(MODULE_ID, FLAG_KEY, null);
      } else {
        return { ok: false, reason: "unavailable" };
      }
      return { ok: true };
    } catch (error) {
      console.error("PF2E Action Forge | Failed to clear exploration activity", error);
      return { ok: false, reason: "update-failed", error };
    }
  }
}

export { FLAG_KEY as EXPLORATION_ACTIVITY_FLAG, MODULE_ID, normalizeStoredActivity };
export const explorationActivityService = new ExplorationActivityService();
