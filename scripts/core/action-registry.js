/**
 * Internal action-definition registry.
 *
 * Definitions are deliberately declarative. UI, target, DC, PF2e execution,
 * visibility, and application layers consume metadata without hard-coding
 * individual actions into the application shell.
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

    const targetDefinition = definition.target && typeof definition.target === "object" ? definition.target : {};
    const targetMode = ["none", "optional", "single", "multiple"].includes(targetDefinition.mode)
      ? targetDefinition.mode
      : "none";
    const defaultRequired = targetMode === "single" || targetMode === "multiple";

    const dcDefinition = definition.dc && typeof definition.dc === "object" ? definition.dc : {};
    const dcStrategy = ["none", "manual", "target-defense", "fixed", "fixed-choice", "gm-defined"].includes(
      dcDefinition.strategy
    )
      ? dcDefinition.strategy
      : "none";

    const executionDefinition =
      definition.execution && typeof definition.execution === "object" ? definition.execution : {};
    const systemActionDefinition =
      definition.systemAction && typeof definition.systemAction === "object" ? definition.systemAction : {};

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
      target: Object.freeze({
        mode: targetMode,
        type: String(targetDefinition.type ?? "creature"),
        required: targetDefinition.required === undefined ? defaultRequired : Boolean(targetDefinition.required)
      }),
      dc: Object.freeze({
        strategy: dcStrategy,
        defense: dcDefinition.defense ? String(dcDefinition.defense) : null,
        manualFallback: Boolean(dcDefinition.manualFallback),
        value: Number.isFinite(dcDefinition.value) ? dcDefinition.value : null,
        choices: Object.freeze(Array.isArray(dcDefinition.choices) ? [...dcDefinition.choices] : [])
      }),
      systemAction: Object.freeze({
        slug: String(systemActionDefinition.slug ?? id).trim() || id
      }),
      execution: Object.freeze({
        enabled: Boolean(executionDefinition.enabled),
        statistic: executionDefinition.statistic ? String(executionDefinition.statistic) : null
      }),
      developmentOnly: Boolean(definition.developmentOnly)
    };
  }
}

export const actionRegistry = new ActionRegistry();
