/**
 * Internal action-definition registry.
 *
 * The catalog metadata introduced in dev.2 is intentionally declarative. Later
 * blocks can add target, DC, visibility and application metadata without
 * coupling the application UI to individual actions.
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

  registerMany(definitions) {
    return [...definitions].map((definition) => this.register(definition));
  }

  get(id) {
    return this.#actions.get(id) ?? null;
  }

  has(id) {
    return this.#actions.has(id);
  }

  list() {
    return [...this.#actions.values()].sort(
      (a, b) => a.categoryOrder - b.categoryOrder || a.order - b.order || a.id.localeCompare(b.id)
    );
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
    const categoryLabel = String(definition.categoryLabel ?? "PF2EActionForge.Categories.General").trim();

    if (!id) throw new Error("PF2E Action Forge | Action definition requires an id.");
    if (!label) throw new Error(`PF2E Action Forge | Action '${id}' requires a label key.`);

    return {
      id,
      label,
      category,
      categoryLabel,
      categoryIcon: String(definition.categoryIcon ?? "fa-solid fa-dice-d20"),
      categoryOrder: Number.isFinite(definition.categoryOrder) ? definition.categoryOrder : 999,
      order: Number.isFinite(definition.order) ? definition.order : 999,
      icon: String(definition.icon ?? "fa-solid fa-dice-d20"),
      description: String(definition.description ?? ""),
      keywords: Object.freeze(
        Array.isArray(definition.keywords)
          ? definition.keywords.map((keyword) => String(keyword).trim()).filter(Boolean)
          : []
      ),
      developmentOnly: Boolean(definition.developmentOnly)
    };
  }
}

export const actionRegistry = new ActionRegistry();
