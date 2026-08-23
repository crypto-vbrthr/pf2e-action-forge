/**
 * Internal action-definition registry.
 *
 * dev.1 intentionally keeps the contract tiny. Later development blocks can
 * extend definitions with target, DC, visibility and application metadata
 * without coupling the UI to individual actions.
 */
export class ActionRegistry {
  #actions = new Map();

  register(definition) {
    const normalized = this.#normalize(definition);
    if (this.#actions.has(normalized.id)) {
      throw new Error(`PF2E Action Forge | Duplicate action id: ${normalized.id}`);
    }
    this.#actions.set(normalized.id, Object.freeze(normalized));
    return normalized;
  }

  get(id) {
    return this.#actions.get(id) ?? null;
  }

  has(id) {
    return this.#actions.has(id);
  }

  list() {
    return [...this.#actions.values()];
  }

  clear() {
    this.#actions.clear();
  }

  #normalize(definition) {
    if (!definition || typeof definition !== "object") {
      throw new TypeError("PF2E Action Forge | Action definition must be an object.");
    }

    const id = String(definition.id ?? "").trim();
    const label = String(definition.label ?? "").trim();
    const category = String(definition.category ?? "general").trim() || "general";

    if (!id) throw new Error("PF2E Action Forge | Action definition requires an id.");
    if (!label) throw new Error(`PF2E Action Forge | Action '${id}' requires a label key.`);

    return {
      id,
      label,
      category,
      icon: String(definition.icon ?? "fa-solid fa-dice-d20"),
      description: String(definition.description ?? ""),
      developmentOnly: Boolean(definition.developmentOnly)
    };
  }
}

export const actionRegistry = new ActionRegistry();
