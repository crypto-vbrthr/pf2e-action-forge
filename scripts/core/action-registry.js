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
    const visibilityDefinition =
      definition.visibility && typeof definition.visibility === "object" ? definition.visibility : {};
    const visibilityModes = new Set(["public", "player-gm", "gm", "blind", "self", "none"]);
    const systemActionDefinition =
      definition.systemAction && typeof definition.systemAction === "object" ? definition.systemAction : {};
    const applicationDefinition =
      definition.application && typeof definition.application === "object" ? definition.application : {};
    const applicationOutcomes = {};
    for (const outcome of ["criticalSuccess", "success", "failure", "criticalFailure"]) {
      const effects = Array.isArray(applicationDefinition.outcomes?.[outcome])
        ? applicationDefinition.outcomes[outcome]
        : [];
      applicationOutcomes[outcome] = Object.freeze(effects.map((effect) => Object.freeze({
        id: String(effect?.id ?? "").trim(),
        type: String(effect?.type ?? "").trim(),
        target: ["source", "target"].includes(effect?.target) ? effect.target : "target",
        condition: effect?.condition ? String(effect.condition).trim() : null,
        value: Number.isFinite(Number(effect?.value)) ? Math.max(0, Math.trunc(Number(effect.value))) : null,
        label: effect?.label ? String(effect.label).trim() : null,
        formula: effect?.formula ? String(effect.formula).trim() : null,
        formulaByDc: Object.freeze(Object.fromEntries(
          Object.entries(effect?.formulaByDc ?? {})
            .filter(([dc, formula]) => Number.isInteger(Number(dc)) && formula)
            .map(([dc, formula]) => [String(Number(dc)), String(formula).trim()])
        )),
        actionId: effect?.actionId ? String(effect.actionId).trim() : null,
        durationSeconds: Number.isFinite(Number(effect?.durationSeconds)) ? Math.max(0, Number(effect.durationSeconds)) : null,
        sourceSpecific: Boolean(effect?.sourceSpecific),
        name: effect?.name ? String(effect.name).trim() : null,
        description: effect?.description ? String(effect.description).trim() : null,
        mode: ["auto", "confirm"].includes(effect?.mode) ? effect.mode : null
      })).filter((effect) => effect.id && effect.type));
    }

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
        choices: Object.freeze(Array.isArray(dcDefinition.choices) ? [...dcDefinition.choices] : []),
        systemTargetFallback: Boolean(dcDefinition.systemTargetFallback),
        systemTargetRequiresStatisticMatch: Boolean(dcDefinition.systemTargetRequiresStatisticMatch),
        allowUnknown: Boolean(dcDefinition.allowUnknown),
        systemTargetStatistics: Object.freeze(
          Array.isArray(dcDefinition.systemTargetStatistics)
            ? dcDefinition.systemTargetStatistics.map((slug) => String(slug)).filter(Boolean)
            : []
        )
      }),
      systemAction: Object.freeze({
        slug: String(systemActionDefinition.slug ?? id).trim() || id
      }),
      execution: Object.freeze({
        enabled: Boolean(executionDefinition.enabled),
        mode: ["system-action", "statistic", "system-or-statistic", "activity"].includes(executionDefinition.mode)
          ? executionDefinition.mode
          : "system-action",
        statistic: executionDefinition.statistic ? String(executionDefinition.statistic) : null,
        statistics: Object.freeze(
          Array.isArray(executionDefinition.statistics)
            ? executionDefinition.statistics.map((slug) => String(slug)).filter(Boolean)
            : []
        ),
        includeLore: Boolean(executionDefinition.includeLore),
        requiresStatistic: Boolean(executionDefinition.requiresStatistic),
        singleTargetOnly: Boolean(executionDefinition.singleTargetOnly),
        minRank: Number.isInteger(Number(executionDefinition.minRank))
          ? Math.max(0, Math.min(4, Number(executionDefinition.minRank)))
          : 0
      }),
      visibility: Object.freeze({
        announcement: visibilityModes.has(visibilityDefinition.announcement) ? visibilityDefinition.announcement : "public",
        roll: visibilityModes.has(visibilityDefinition.roll) ? visibilityDefinition.roll : "public",
        outcome: visibilityModes.has(visibilityDefinition.outcome) ? visibilityDefinition.outcome : "public"
      }),
      application: Object.freeze({
        mode: ["auto", "confirm", "manual"].includes(applicationDefinition.mode) ? applicationDefinition.mode : "manual",
        blockIfImmuneActionId: applicationDefinition.blockIfImmuneActionId
          ? String(applicationDefinition.blockIfImmuneActionId).trim()
          : null,
        outcomeNotes: Object.freeze(Object.fromEntries(
          Object.entries(applicationDefinition.outcomeNotes ?? {})
            .filter(([outcome, key]) => ["criticalSuccess", "success", "failure", "criticalFailure"].includes(outcome) && key)
            .map(([outcome, key]) => [outcome, String(key)])
        )),
        outcomes: Object.freeze(applicationOutcomes)
      }),
      developmentOnly: Boolean(definition.developmentOnly)
    };
  }
}

export const actionRegistry = new ActionRegistry();
