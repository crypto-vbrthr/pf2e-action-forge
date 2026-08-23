const MODULE_ID = "pf2e-action-forge";
const FAVORITES_FLAG = "favorites";

/**
 * Stores Action Forge favorites on the current Foundry User document.
 * This makes favorites personal to each user and persistent across sessions.
 */
export class FavoritesService {
  getIds() {
    const stored = game?.user?.getFlag?.(MODULE_ID, FAVORITES_FLAG);
    if (!Array.isArray(stored)) return [];
    return [...new Set(stored.filter((id) => typeof id === "string" && id.trim()))];
  }

  has(actionId) {
    return this.getIds().includes(actionId);
  }

  async toggle(actionId) {
    const id = String(actionId ?? "").trim();
    if (!id) throw new Error("PF2E Action Forge | Cannot toggle an empty favorite id.");

    const favorites = new Set(this.getIds());
    const added = !favorites.has(id);
    if (added) favorites.add(id);
    else favorites.delete(id);

    const next = [...favorites];
    if (typeof game?.user?.setFlag !== "function") {
      throw new Error("PF2E Action Forge | Current user cannot persist favorites.");
    }

    await game.user.setFlag(MODULE_ID, FAVORITES_FLAG, next);
    return { added, ids: next };
  }
}

export const favoritesService = new FavoritesService();
