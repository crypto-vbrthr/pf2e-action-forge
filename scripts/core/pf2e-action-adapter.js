import { visibilityEngine } from "./visibility-engine.js";

const FALLBACK_SYSTEM_SLUGS = Object.freeze({
  "recall-knowledge": "recall-knowledge",
  "tumble-through": "tumble-through",
  grapple: "grapple",
  trip: "trip",
  climb: "climb",
  lie: "lie",
  demoralize: "demoralize",
  "treat-wounds": "treat-wounds"
});

export class PF2eActionAdapter {
  getSystemAction(definition) {
    const actions = game?.pf2e?.actions;
    if (!actions) return null;

    const slug = definition?.systemAction?.slug || FALLBACK_SYSTEM_SLUGS[definition?.id] || definition?.id;
    if (!slug) return null;

    const candidates = [];
    if (typeof actions.get === "function") {
      candidates.push(actions.get(slug));
      candidates.push(actions.get(definition?.id));
    }

    candidates.push(actions[slug]);
    candidates.push(actions[definition?.id]);

    if (actions instanceof Map) {
      candidates.push(actions.get(slug));
      candidates.push(actions.get(definition?.id));
    }

    if (typeof actions.values === "function") {
      try {
        for (const action of actions.values()) {
          if (action?.slug === slug) candidates.push(action);
        }
      } catch (_error) {
        // Some collection-like implementations expose values differently.
      }
    } else if (typeof actions === "object") {
      candidates.push(...Object.values(actions).filter((action) => action?.slug === slug));
    }

    return candidates.find((candidate) => candidate && typeof candidate.use === "function") ?? null;
  }

  isAvailable(definition) {
    return Boolean(definition?.execution?.enabled && this.getSystemAction(definition));
  }

  async execute({ definition, actor, target = null, difficultyClass, statistic = null, event = null }) {
    if (!definition?.execution?.enabled) {
      return { ok: false, reason: "not-enabled", results: [] };
    }
    if (!actor) return { ok: false, reason: "no-actor", results: [] };

    const action = this.getSystemAction(definition);
    if (!action) return { ok: false, reason: "missing-system-action", results: [] };

    try {
      const options = {
        actors: actor,
        event: event ?? undefined,
        message: { create: true }
      };
      if (target) options.target = target;
      if (difficultyClass !== undefined) options.difficultyClass = difficultyClass;
      const selectedStatistic = statistic || definition.execution?.statistic;
      if (selectedStatistic) options.statistic = selectedStatistic;

      const visibilityTraits = visibilityEngine.getRollTraits(definition, action);
      if (visibilityTraits.length > 0) options.traits = visibilityTraits;

      const results = await action.use(options);
      return {
        ok: true,
        action,
        results: Array.isArray(results) ? results : []
      };
    } catch (error) {
      console.error("PF2E Action Forge | PF2e action execution failed", error);
      return { ok: false, reason: "execution-error", error, results: [] };
    }
  }
}

export const pf2eActionAdapter = new PF2eActionAdapter();
