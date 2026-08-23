import { MODULE_ID } from "./action-transaction.js";

function worldTime() {
  const value = Number(globalThis.game?.time?.worldTime ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function itemList(actor) {
  if (!actor?.items) return [];
  if (Array.isArray(actor.items)) return actor.items;
  if (Array.isArray(actor.items.contents)) return actor.items.contents;
  try {
    return [...actor.items];
  } catch (_error) {
    return [];
  }
}

export function getActiveActionImmunity(actor, actionId, { sourceActor = null } = {}) {
  if (!actor || !actionId) return null;
  const now = worldTime();

  for (const item of itemList(actor)) {
    const immunity = item?.flags?.[MODULE_ID]?.immunity;
    if (!immunity || immunity.actionId !== actionId) continue;
    if (item.isExpired === true) continue;

    const expiresAt = Number(immunity.expiresAtWorldTime);
    if (Number.isFinite(expiresAt) && expiresAt <= now) continue;

    if (immunity.sourceSpecific) {
      if (!sourceActor?.uuid || immunity.sourceActorUuid !== sourceActor.uuid) continue;
    }

    return {
      item,
      actionId,
      sourceSpecific: Boolean(immunity.sourceSpecific),
      sourceActorUuid: immunity.sourceActorUuid ?? null,
      expiresAtWorldTime: Number.isFinite(expiresAt) ? expiresAt : null,
      remainingSeconds: Number.isFinite(expiresAt) ? Math.max(0, expiresAt - now) : null
    };
  }

  return null;
}

export function hasActiveActionImmunity(actor, actionId, options = {}) {
  return Boolean(getActiveActionImmunity(actor, actionId, options));
}
