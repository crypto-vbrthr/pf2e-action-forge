const CREATURE_TYPES = new Set(["character", "npc", "familiar"]);

/**
 * Resolves the actor that is currently acting in Action Forge.
 *
 * Priority:
 * 1. Explicit in-window selection (while still permitted)
 * 2. Exactly one controlled token
 * 3. The user's assigned character
 * 4. First permitted actor, preferring characters
 *
 * Players only receive actors they own. A GM may use any creature actor.
 */
export class ActorResolver {
  #selectedActorUuid = null;

  setSelectedActor(uuid) {
    this.#selectedActorUuid = uuid || null;
  }

  clearSelectedActor() {
    this.#selectedActorUuid = null;
  }

  getAvailableActors() {
    const actors = game?.actors?.contents ?? [];
    return actors
      .filter((actor) => this.#isCreatureActor(actor))
      .filter((actor) => this.#canActWith(actor))
      .sort((a, b) => {
        const aCharacter = a.type === "character" ? 0 : 1;
        const bCharacter = b.type === "character" ? 0 : 1;
        return aCharacter - bCharacter || a.name.localeCompare(b.name, game.i18n.lang);
      });
  }

  resolve() {
    const available = this.getAvailableActors();

    if (this.#selectedActorUuid) {
      const selected = available.find((actor) => actor.uuid === this.#selectedActorUuid);
      if (selected) return selected;
      this.#selectedActorUuid = null;
    }

    const controlled = (canvas?.tokens?.controlled ?? [])
      .map((token) => token.actor)
      .filter(Boolean)
      .filter((actor) => available.some((candidate) => candidate.uuid === actor.uuid));

    if (controlled.length === 1) return controlled[0];

    const assigned = game?.user?.character;
    if (assigned && available.some((actor) => actor.uuid === assigned.uuid)) return assigned;

    return available[0] ?? null;
  }

  getContext() {
    const actor = this.resolve();
    const actors = this.getAvailableActors();

    return {
      actor,
      actors,
      source: actor ? this.#sourceFor(actor) : "none"
    };
  }

  #sourceFor(actor) {
    if (this.#selectedActorUuid === actor.uuid) return "selection";

    const controlled = canvas?.tokens?.controlled ?? [];
    if (controlled.length === 1 && controlled[0]?.actor?.uuid === actor.uuid) return "token";
    if (game?.user?.character?.uuid === actor.uuid) return "assigned";
    return "fallback";
  }

  #canActWith(actor) {
    if (game?.user?.isGM) return true;

    const ownerLevel = CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
    if (typeof actor.testUserPermission === "function") {
      return actor.testUserPermission(game.user, ownerLevel);
    }
    return Boolean(actor.isOwner);
  }

  #isCreatureActor(actor) {
    if (!actor) return false;
    if (typeof actor.isOfType === "function") {
      try {
        if (actor.isOfType("creature")) return true;
      } catch (_error) {
        // Fall through to the stable PF2e actor-type allowlist.
      }
    }
    return CREATURE_TYPES.has(actor.type);
  }
}

export const actorResolver = new ActorResolver();
