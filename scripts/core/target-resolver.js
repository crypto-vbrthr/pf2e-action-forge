const CREATURE_TYPES = new Set(["character", "npc", "familiar"]);
const TARGET_MODES = new Set(["none", "optional", "single", "multiple"]);

/**
 * Resolves Action Forge targets from two sources:
 * - Foundry's current user token targets on the active canvas
 * - Actors explicitly dropped from the sidebar into Action Forge
 *
 * Canvas targets are never copied into persistent state. This keeps the Forge in
 * sync with Foundry's native target markers. Dropped actors are kept only for the
 * currently selected action and are cleared whenever another action is chosen.
 */
export class TargetResolver {
  #manualTargets = new Map();
  #activeActionId = null;

  activate(action) {
    const actionId = action?.id ?? null;
    if (this.#activeActionId !== actionId) {
      this.#activeActionId = actionId;
      this.#manualTargets.clear();
    }
  }

  clear() {
    this.#activeActionId = null;
    this.#manualTargets.clear();
  }

  clearManualTargets() {
    this.#manualTargets.clear();
  }

  /**
   * A newly targeted canvas token should take precedence over a previously
   * dropped sidebar actor for single-target actions.
   */
  preferCanvas(action) {
    if (this.#mode(action) === "single" || this.#mode(action) === "optional") {
      this.#manualTargets.clear();
    }
  }

  getState(action) {
    const mode = this.#mode(action);
    const canvasTargets = this.#getCanvasTargets();
    const manualTargets = [...this.#manualTargets.values()];
    const targets = this.#resolveTargets(mode, canvasTargets, manualTargets);

    return {
      mode,
      targets,
      count: targets.length,
      canvasCount: canvasTargets.length,
      manualCount: manualTargets.length,
      required: mode === "single" || mode === "multiple",
      allowsTargets: mode !== "none",
      allowsMultiple: mode === "multiple",
      valid:
        mode === "none" ||
        mode === "optional" ||
        (mode === "single" && targets.length === 1) ||
        (mode === "multiple" && targets.length >= 1),
      canvasOverflow: manualTargets.length === 0 && (mode === "single" || mode === "optional") && canvasTargets.length > 1
    };
  }

  async addFromDropEvent(event, action) {
    const mode = this.#mode(action);
    if (mode === "none") {
      return { ok: false, reason: "not-allowed" };
    }

    const data = this.#getDropData(event);
    if (!data) return { ok: false, reason: "invalid-data" };

    const document = await this.#resolveDropDocument(data);
    const actor = this.#actorFromDocument(document);

    if (!actor || !this.#isCreatureActor(actor)) {
      return { ok: false, reason: "invalid-actor" };
    }
    if (!this.#canSeeTarget(actor)) {
      return { ok: false, reason: "not-visible" };
    }

    const entry = this.#manualEntry(actor);
    if (mode === "single" || mode === "optional") this.#manualTargets.clear();
    this.#manualTargets.set(entry.key, entry);
    return { ok: true, entry };
  }

  async remove(key) {
    if (this.#manualTargets.delete(key)) return true;

    const canvasEntry = this.#getCanvasTargets().find((entry) => entry.key === key);
    const token = canvasEntry?.token;
    if (!token) return false;

    try {
      if (typeof token.setTarget === "function") {
        token.setTarget(false, { user: game.user, releaseOthers: false });
        return true;
      }
    } catch (error) {
      console.warn("PF2E Action Forge | Failed to release canvas target", error);
    }
    return false;
  }

  #mode(action) {
    const mode = action?.target?.mode ?? "none";
    return TARGET_MODES.has(mode) ? mode : "none";
  }

  #resolveTargets(mode, canvasTargets, manualTargets) {
    if (mode === "none") return [];

    if (mode === "single" || mode === "optional") {
      if (manualTargets.length) return [manualTargets.at(-1)];
      if (canvasTargets.length) return [canvasTargets.at(-1)];
      return [];
    }

    // Multiple targets may combine token targets and sidebar actors. Deduplicate
    // by actor UUID and prefer the canvas representation because it retains token
    // context for later range/scene-aware workflows.
    const combined = new Map();
    for (const entry of canvasTargets) combined.set(entry.actorUuid ?? entry.key, entry);
    for (const entry of manualTargets) {
      const identity = entry.actorUuid ?? entry.key;
      if (!combined.has(identity)) combined.set(identity, entry);
    }
    return [...combined.values()];
  }

  #getCanvasTargets() {
    const targets = [...(game?.user?.targets ?? [])];
    const entries = [];

    for (const token of targets) {
      const actor = token?.actor;
      if (!actor || !this.#isCreatureActor(actor)) continue;
      const tokenUuid = token?.document?.uuid ?? token?.uuid ?? null;
      const actorUuid = actor.uuid ?? null;
      const key = tokenUuid ? `token:${tokenUuid}` : `actor:${actorUuid}`;
      entries.push({
        key,
        source: "canvas",
        actor,
        token,
        actorUuid,
        tokenUuid,
        name: token?.name ?? actor.name,
        img: token?.document?.texture?.src ?? actor.img
      });
    }
    return entries;
  }

  #manualEntry(actor) {
    return {
      key: `actor:${actor.uuid}`,
      source: "sidebar",
      actor,
      token: null,
      actorUuid: actor.uuid,
      tokenUuid: null,
      name: actor.name,
      img: actor.img
    };
  }

  #getDropData(event) {
    try {
      if (globalThis.TextEditor?.getDragEventData) {
        const data = TextEditor.getDragEventData(event);
        if (data && Object.keys(data).length) return data;
      }
    } catch (_error) {
      // Fall back to parsing the plain-text payload below.
    }

    const raw = event?.dataTransfer?.getData?.("text/plain");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_error) {
      return null;
    }
  }

  async #resolveDropDocument(data) {
    if (data?.uuid && typeof globalThis.fromUuid === "function") {
      try {
        return await fromUuid(data.uuid);
      } catch (_error) {
        // Fall through to id-based resolution below.
      }
    }

    if (data?.type === "Actor" && data?.id) return game?.actors?.get?.(data.id) ?? null;

    if (data?.type === "Token" && data?.id) {
      const scene = data.sceneId ? game?.scenes?.get?.(data.sceneId) : canvas?.scene;
      return scene?.tokens?.get?.(data.id) ?? null;
    }

    return null;
  }

  #actorFromDocument(document) {
    if (!document) return null;
    if (document.documentName === "Actor" || document.constructor?.metadata?.name === "Actor") return document;
    if (this.#isCreatureActor(document)) return document;
    if (document.actor) return document.actor;
    if (document.document?.actor) return document.document.actor;
    return null;
  }

  #canSeeTarget(actor) {
    if (game?.user?.isGM) return true;
    if (actor.visible === false) return false;

    const limited = CONST?.DOCUMENT_OWNERSHIP_LEVELS?.LIMITED ?? 1;
    if (typeof actor.testUserPermission === "function") {
      try {
        return actor.testUserPermission(game.user, limited);
      } catch (_error) {
        return actor.visible !== false;
      }
    }
    return actor.visible !== false;
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

export const targetResolver = new TargetResolver();
