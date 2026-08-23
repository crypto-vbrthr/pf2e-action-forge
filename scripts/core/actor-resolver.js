const CREATURE_TYPES = new Set(["character", "npc", "familiar"]);
export const CURRENT_TOKEN_SELECTION = "__current-token__";

/**
 * Resolves the actor that is currently acting in Action Forge.
 *
 * Selection modes:
 * - auto: follow exactly one controlled creature token; if none is available,
 *   fall back to the user's assigned character and then another permitted actor.
 * - explicit: pin a specific permitted actor until the user switches back to auto.
 *
 * Controlled token actors are included even when the token is unlinked and its
 * synthetic actor therefore does not exist in game.actors.
 *
 * Players may use creature actors they own. PF2e familiars are additionally
 * permitted when their configured master is owned by the player. This mirrors
 * the familiar/master relationship without exposing unrelated actors.
 */
export class ActorResolver {
  #selectedActorUuid = null;
  #lockedActor = null;
  #lockedSource = null;

  setSelectedActor(uuid) {
    if (!uuid || uuid === CURRENT_TOKEN_SELECTION) {
      this.followCurrentToken();
      return;
    }
    this.#selectedActorUuid = uuid;
  }

  followCurrentToken() {
    this.#selectedActorUuid = null;
  }

  clearSelectedActor() {
    this.followCurrentToken();
  }

  get followsCurrentToken() {
    return this.#selectedActorUuid === null;
  }

  get isActionLocked() {
    return Boolean(this.#lockedActor);
  }

  lockActionActor(actor = this.#resolveUnlocked()) {
    if (!actor) return null;
    if (!this.#canActWith(actor)) return null;
    if (!this.#lockedActor) {
      this.#lockedActor = actor;
      this.#lockedSource = this.#sourceFor(actor);
    }
    return this.#lockedActor;
  }

  unlockActionActor() {
    this.#lockedActor = null;
    this.#lockedSource = null;
  }

  getAvailableActors() {
    const actors = [
      ...(this.#lockedActor ? [this.#lockedActor] : []),
      ...this.#getControlledActors(),
      ...(game?.actors?.contents ?? [])
    ];

    const uniqueActors = new Map();
    for (const actor of actors) {
      if (!this.#isCreatureActor(actor) || !this.#canActWith(actor)) continue;
      if (!uniqueActors.has(actor.uuid)) uniqueActors.set(actor.uuid, actor);
    }

    return [...uniqueActors.values()].sort((a, b) => {
      const aControlled = this.#isControlledActor(a) ? 0 : 1;
      const bControlled = this.#isControlledActor(b) ? 0 : 1;
      const aCharacter = a.type === "character" ? 0 : 1;
      const bCharacter = b.type === "character" ? 0 : 1;
      return (
        aControlled - bControlled ||
        aCharacter - bCharacter ||
        a.name.localeCompare(b.name, game.i18n.lang)
      );
    });
  }

  resolve() {
    if (this.#lockedActor) return this.#lockedActor;
    return this.#resolveUnlocked();
  }

  #resolveUnlocked() {
    const available = this.getAvailableActors();

    if (this.#selectedActorUuid) {
      const selected = available.find((actor) => actor.uuid === this.#selectedActorUuid);
      if (selected) return selected;
      // If a pinned actor ceases to be available, safely return to automatic mode.
      this.#selectedActorUuid = null;
    }

    const controlled = this.#getControlledActors()
      .filter((actor) => this.#isCreatureActor(actor))
      .filter((actor) => this.#canActWith(actor));

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
      source: actor ? (this.#lockedActor ? this.#lockedSource : this.#sourceFor(actor)) : "none",
      selectionMode: this.followsCurrentToken ? "auto" : "explicit",
      actionLocked: this.isActionLocked
    };
  }

  #sourceFor(actor) {
    if (this.#selectedActorUuid === actor.uuid) return "selection";
    if (this.#isControlledActor(actor)) return "token";
    if (game?.user?.character?.uuid === actor.uuid) return "assigned";
    return "fallback";
  }

  #getControlledActors() {
    const uniqueActors = new Map();
    for (const token of canvas?.tokens?.controlled ?? []) {
      const actor = token?.actor;
      if (!actor?.uuid || uniqueActors.has(actor.uuid)) continue;
      uniqueActors.set(actor.uuid, actor);
    }
    return [...uniqueActors.values()];
  }

  #isControlledActor(actor) {
    return this.#getControlledActors().some((candidate) => candidate.uuid === actor.uuid);
  }

  #canActWith(actor) {
    if (game?.user?.isGM) return true;
    if (this.#hasOwnerPermission(actor)) return true;

    // PF2e familiars expose their configured character master as actor.master.
    // Let the master's owner use the familiar even if its own ownership was not
    // manually raised from PF2e's default LIMITED level.
    if (actor?.type === "familiar") {
      const master = this.#getFamiliarMaster(actor);
      if (master && this.#hasOwnerPermission(master)) return true;
    }

    return false;
  }

  #hasOwnerPermission(actor) {
    if (!actor) return false;
    const ownerLevel = CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
    if (typeof actor.testUserPermission === "function") {
      return actor.testUserPermission(game.user, ownerLevel);
    }
    return Boolean(actor.isOwner);
  }

  #getFamiliarMaster(actor) {
    try {
      if (actor.master) return actor.master;
    } catch (_error) {
      // Fall back to the stored PF2e master id below.
    }

    const masterId = actor?.system?.master?.id;
    return masterId ? game?.actors?.get?.(masterId) ?? null : null;
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
