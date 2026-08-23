import { actionRegistry } from "./action-registry.js";
import { getActiveActionImmunity } from "./action-immunity.js";
import { MODULE_ID } from "./action-transaction.js";

const SOCKET = `module.${MODULE_ID}`;
const REQUEST_TIMEOUT = 7000;
const CREATURE_TYPES = new Set(["character", "npc", "familiar"]);
const GROUP_ORDER = Object.freeze(["owned", "party", "characters", "scene", "visible"]);

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

function collectionValues(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return [...collection];
  if (typeof collection.values === "function") {
    try { return [...collection.values()]; } catch (_error) { /* fall through */ }
  }
  try { return [...collection]; } catch (_error) { return []; }
}

function isCreatureActor(actor) {
  if (!actor) return false;
  if (typeof actor.isOfType === "function") {
    try {
      if (actor.isOfType("creature")) return true;
    } catch (_error) {
      // Continue through the stable PF2e actor-type allowlist.
    }
  }
  return CREATURE_TYPES.has(actor.type);
}

function hasPermission(actor, user, level) {
  if (!actor || !user) return false;
  try {
    if (typeof actor.testUserPermission === "function") return actor.testUserPermission(user, level);
  } catch (_error) {
    return false;
  }
  return Boolean(actor.isOwner && user.id === globalThis.game?.user?.id);
}

/**
 * Supplies a deliberately small, sanitized Actor directory for actions that are
 * normally used outside encounters. The player receives only UUID, name, image,
 * type and category metadata, never hidden actor data or defenses.
 *
 * For players, the list is built by one deterministic active GM so party members
 * and assigned PCs can be offered even when the requesting player has no Actor
 * ownership. The same eligibility rules are reused by the Application Broker to
 * validate a later privileged write against a picker-selected target.
 */
export class TargetPickerService {
  #pending = new Map();
  #initialized = false;

  initialize() {
    if (this.#initialized || !globalThis.game?.socket) return;
    this.#initialized = true;
    game.socket.on(SOCKET, (message) => this.#onSocket(message));
  }

  getBroker(users = globalThis.game?.users ?? []) {
    return collectionValues(users)
      .filter((user) => Boolean(user?.isGM && user?.active))
      .sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")))[0] ?? null;
  }

  isAvailable() {
    const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    return Boolean(globalThis.game?.user && typeof DialogV2?.input === "function");
  }

  /** Return a sanitized target directory for the current user. */
  async request({ actionId = null, sourceActorUuid = null } = {}) {
    const requester = globalThis.game?.user;
    if (!requester) return { ok: false, reason: "no-user", groups: [] };

    if (requester.isGM) {
      return { ok: true, groups: await this.buildGroups(requester, { actionId, sourceActorUuid }), source: "local" };
    }

    // Most out-of-combat targets (party members, assigned PCs, owned actors and
    // visible scene actors) are already safely identifiable on the player client.
    // Prefer that local, permission-filtered directory so normal healing workflows
    // do not depend on a round-trip to the GM at all.
    const localGroups = await this.buildGroups(requester, { actionId, sourceActorUuid });
    if (localGroups.some((group) => (group.targets?.length ?? 0) > 0)) {
      return { ok: true, groups: localGroups, source: "local" };
    }

    // Only fall back to the GM directory when the player cannot resolve any safe
    // target locally. This covers unusual permission setups without making the
    // common path wait on a socket response.
    const broker = this.getBroker();
    if (!broker) return { ok: false, reason: "no-active-gm", groups: [] };
    if (!globalThis.game?.socket) return { ok: false, reason: "socket-unavailable", groups: [] };

    const requestId = globalThis.foundry?.utils?.randomID?.(20) ?? `${Date.now()}-${Math.random()}`;
    const promise = new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(requestId);
        resolve({ ok: false, reason: "timeout", groups: [] });
      }, REQUEST_TIMEOUT);
      this.#pending.set(requestId, { resolve, timeout });
    });

    game.socket.emit(SOCKET, {
      type: "target-list-request",
      requestId,
      brokerId: broker.id,
      requesterId: requester.id,
      actionId,
      sourceActorUuid,
      allowAnyBroker: true
    });
    return promise;
  }

  /**
   * Present the sanitized list locally. Multiple-target actions add one target
   * per picker invocation, keeping the control simple and predictable.
   */
  async choose({ definition, sourceActor } = {}) {
    const result = await this.request({ actionId: definition?.id ?? null, sourceActorUuid: sourceActor?.uuid ?? null });
    if (!result.ok) return result;

    const entries = result.groups.flatMap((group) => group.targets ?? []);
    if (entries.length === 0) return { ok: false, reason: "no-targets" };

    const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    if (typeof DialogV2?.input !== "function") return { ok: false, reason: "dialog-unavailable" };

    const optionGroups = result.groups
      .filter((group) => (group.targets?.length ?? 0) > 0)
      .map((group) => {
        const label = globalThis.game?.i18n?.localize?.(`PF2EActionForge.Target.Picker.Group.${group.id}`) ?? group.id;
        const options = group.targets.map((entry) => {
          const immuneLabel = entry.blockedActionId
            ? ` — ${globalThis.game?.i18n?.localize?.("PF2EActionForge.Target.Picker.Immune") ?? "currently unavailable"}`
            : "";
          return `<option value="${escapeHtml(entry.actorUuid)}" ${entry.blockedActionId ? "disabled" : ""}>${escapeHtml(entry.name)}${escapeHtml(immuneLabel)}</option>`;
        }).join("");
        return `<optgroup label="${escapeHtml(label)}">${options}</optgroup>`;
      }).join("");

    const content = `
      <div class="af-target-picker-dialog">
        <p>${escapeHtml(globalThis.game?.i18n?.localize?.("PF2EActionForge.Target.Picker.Hint") ?? "Choose a target for this action.")}</p>
        <label>
          <span>${escapeHtml(globalThis.game?.i18n?.localize?.("PF2EActionForge.Target.Picker.Label") ?? "Target")}</span>
          <select name="target" required autofocus>${optionGroups}</select>
        </label>
      </div>`;

    let response;
    try {
      response = await DialogV2.input({
        window: { title: globalThis.game?.i18n?.localize?.("PF2EActionForge.Target.Picker.Title") ?? "Action Forge · Choose Target" },
        content,
        ok: { label: globalThis.game?.i18n?.localize?.("PF2EActionForge.Target.Picker.Select") ?? "Select Target" },
        rejectClose: false,
        modal: true
      });
    } catch (error) {
      console.error("PF2E Action Forge | Target picker dialog failed", error);
      return { ok: false, reason: "dialog-error", error };
    }

    if (!response?.target) return { ok: false, reason: "cancelled" };
    const entry = entries.find((candidate) => candidate.actorUuid === response.target);
    if (!entry) return { ok: false, reason: "invalid-selection" };
    if (entry.blockedActionId) return { ok: false, reason: "blocked", entry };
    return { ok: true, entry };
  }

  /** Build safe, de-duplicated target groups on a GM client. */
  async buildGroups(requester, { actionId = null, sourceActorUuid = null } = {}) {
    const ownerLevel = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
    const limitedLevel = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.LIMITED ?? 1;
    const partyActors = collectionValues(globalThis.game?.actors?.party?.members).filter(isCreatureActor);
    const assignedActors = collectionValues(globalThis.game?.users)
      .filter((user) => !user?.isGM && user?.character && isCreatureActor(user.character))
      .map((user) => user.character);
    const partyMembers = new Set(partyActors.map((actor) => actor?.uuid).filter(Boolean));
    const assignedCharacters = new Set(assignedActors.map((actor) => actor?.uuid).filter(Boolean));
    const viewedSceneId = requester?.viewedScene ?? requester?._source?.viewedScene ?? null;
    const scene = viewedSceneId
      ? globalThis.game?.scenes?.get?.(viewedSceneId) ?? null
      : globalThis.canvas?.scene ?? null;
    const sceneActors = collectionValues(scene?.tokens)
      .filter((token) => token?.hidden !== true && token?.actor && isCreatureActor(token.actor))
      .map((token) => token.actor);
    const sceneActorUuids = new Set(sceneActors.map((actor) => actor.uuid).filter(Boolean));

    // Do not rely solely on game.actors: assigned characters, party members and
    // synthetic scene actors can be valid and safe targets even when they are not
    // present in the requesting client's world Actor collection.
    const actorMap = new Map();
    for (const actor of [
      ...collectionValues(globalThis.game?.actors),
      ...assignedActors,
      ...partyActors,
      ...sceneActors
    ]) {
      if (!isCreatureActor(actor) || !actor?.uuid || actorMap.has(actor.uuid)) continue;
      actorMap.set(actor.uuid, actor);
    }
    const actors = [...actorMap.values()];

    let sourceActor = sourceActorUuid ? actorMap.get(sourceActorUuid) ?? null : null;
    if (!sourceActor && sourceActorUuid && typeof globalThis.fromUuid === "function") {
      try { sourceActor = await fromUuid(sourceActorUuid); } catch (_error) { sourceActor = null; }
    }

    const action = actionRegistry.get(actionId);
    const immunityActionId = action?.application?.blockIfImmuneActionId ?? null;
    const groups = new Map(GROUP_ORDER.map((id) => [id, []]));
    const claimed = new Set();

    const add = (category, actor) => {
      if (!actor?.uuid || claimed.has(actor.uuid)) return;
      claimed.add(actor.uuid);
      const immunity = immunityActionId ? getActiveActionImmunity(actor, immunityActionId, { sourceActor }) : null;
      groups.get(category).push({
        actorUuid: actor.uuid,
        name: actor.name ?? "",
        img: actor.img ?? "icons/svg/mystery-man.svg",
        type: actor.type ?? null,
        category,
        owned: requester?.isGM || hasPermission(actor, requester, ownerLevel),
        blockedActionId: immunity ? immunityActionId : null
      });
    };

    // The order here also defines which label wins when an Actor qualifies for
    // multiple groups. Owned creatures and party members are the most useful.
    for (const actor of actors) if (requester?.isGM || hasPermission(actor, requester, ownerLevel)) add("owned", actor);
    for (const actor of actors) if (partyMembers.has(actor.uuid)) add("party", actor);
    for (const actor of actors) if (assignedCharacters.has(actor.uuid)) add("characters", actor);
    for (const actor of actors) if (sceneActorUuids.has(actor.uuid)) add("scene", actor);
    for (const actor of actors) if (requester?.isGM || hasPermission(actor, requester, limitedLevel)) add("visible", actor);

    const locale = globalThis.game?.i18n?.lang;
    return GROUP_ORDER.map((id) => ({
      id,
      targets: groups.get(id).sort((a, b) => a.name.localeCompare(b.name, locale))
    })).filter((group) => group.targets.length > 0);
  }

  /** Revalidate a picker target at privileged application time. */
  isEligibleTarget(actor, requester) {
    if (!actor || !requester || !isCreatureActor(actor)) return false;
    if (requester.isGM) return true;

    const ownerLevel = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
    const limitedLevel = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.LIMITED ?? 1;
    if (hasPermission(actor, requester, ownerLevel)) return true;

    const partyMembers = collectionValues(globalThis.game?.actors?.party?.members);
    if (partyMembers.some((member) => member?.uuid === actor.uuid)) return true;

    if (collectionValues(globalThis.game?.users).some((user) => !user?.isGM && user?.character?.uuid === actor.uuid)) return true;

    const viewedSceneId = requester?.viewedScene ?? requester?._source?.viewedScene ?? null;
    const scene = viewedSceneId ? globalThis.game?.scenes?.get?.(viewedSceneId) : globalThis.canvas?.scene;
    if (collectionValues(scene?.tokens).some((token) => token?.hidden !== true && token?.actor?.uuid === actor.uuid)) return true;

    return hasPermission(actor, requester, limitedLevel);
  }

  async #onSocket(message) {
    if (!message || typeof message !== "object") return;

    if (message.type === "target-list-response" && message.requesterId === globalThis.game?.user?.id) {
      const pending = this.#pending.get(message.requestId);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.#pending.delete(message.requestId);
      pending.resolve(message.result ?? { ok: false, reason: "empty-response", groups: [] });
      return;
    }

    if (message.type !== "target-list-request") return;
    if (!globalThis.game?.user?.isGM) return;
    if (!message.allowAnyBroker && message.brokerId !== globalThis.game.user.id) return;

    let result;
    try {
      const requester = globalThis.game?.users?.get?.(message.requesterId)
        ?? collectionValues(globalThis.game?.users).find((user) => user?.id === message.requesterId);
      result = requester
        ? { ok: true, groups: await this.buildGroups(requester, { actionId: message.actionId, sourceActorUuid: message.sourceActorUuid }), source: "gm" }
        : { ok: false, reason: "unknown-requester", groups: [] };
    } catch (error) {
      console.error("PF2E Action Forge | GM target directory request failed", error);
      result = { ok: false, reason: "gm-directory-error", groups: [] };
    }

    game.socket.emit(SOCKET, {
      type: "target-list-response",
      requestId: message.requestId,
      requesterId: message.requesterId,
      responderId: globalThis.game.user.id,
      result
    });
  }
}

export { isCreatureActor };
export const targetPickerService = new TargetPickerService();
