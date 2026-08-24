import { resolveActorDefenseDc } from "./dc-resolver.js";
import { visibilityEngine } from "./visibility-engine.js";

const FALLBACK_SYSTEM_SLUGS = Object.freeze({
  escape: "escape",
  "sense-motive": "sense-motive",
  seek: "seek",
  aid: "aid",
  "recall-knowledge": "recall-knowledge",
  "earn-income": "earn-income",
  "identify-magic": "identify-magic",
  "decipher-writing": "decipher-writing",
  "learn-a-spell": "learn-a-spell",
  "prepare-from-spellbook": "borrow-an-arcane-spell",
  "maneuver-in-flight": "maneuver-in-flight",
  "create-forgery": "create-forgery",
  "command-an-animal": "command-an-animal",
  balance: "balance",
  "tumble-through": "tumble-through",
  squeeze: "squeeze",
  grapple: "grapple",
  trip: "trip",
  shove: "shove",
  reposition: "reposition",
  disarm: "disarm",
  "force-open": "force-open",
  climb: "climb",
  swim: "swim",
  "high-jump": "high-jump",
  "long-jump": "long-jump",
  "create-a-diversion": "create-a-diversion",
  lie: "lie",
  feint: "feint",
  perform: "perform",
  "palm-an-object": "palm-an-object",
  steal: "steal",
  "disable-a-device": "disable-a-device",
  "pick-a-lock": "pick-a-lock",
  "make-an-impression": "make-an-impression",
  request: "request",
  "gather-information": "gather-information",
  impersonate: "impersonate",
  coerce: "coerce",
  "conceal-an-object": "conceal-an-object",
  hide: "hide",
  sneak: "sneak",
  subsist: "subsist",
  "sense-direction": "sense-direction",
  track: "track",
  "cover-tracks": "cover-tracks",
  repair: "repair",
  "identify-alchemy": "identify-alchemy",
  craft: "craft",
  "administer-first-aid-stabilize": "administer-first-aid",
  "administer-first-aid-stop-bleeding": "administer-first-aid",
  "treat-disease": "treat-disease",
  "treat-poison": "treat-poison",
  demoralize: "demoralize",
  "treat-wounds": "treat-wounds"
});

const DEGREE_OF_SUCCESS = Object.freeze([
  "criticalFailure",
  "failure",
  "success",
  "criticalSuccess"
]);

function actorFromTarget(target) {
  if (!target) return null;
  if (target.actor) return target.actor;
  if (typeof target.getStatistic === "function" || typeof target.getSelfRollOptions === "function") return target;
  return null;
}

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
    if (!definition?.execution?.enabled) return false;
    if (["statistic", "system-or-statistic", "activity", "exploration-activity"].includes(definition.execution.mode)) return true;
    return Boolean(this.getSystemAction(definition));
  }

  async executeShared({ definition, actor, statistic = null, event = null }) {
    if (!definition?.execution?.sharedRoll) {
      return { ok: false, reason: "not-shared-roll", results: [] };
    }
    if (!actor) return { ok: false, reason: "no-actor", results: [] };

    // A shared roll must be generated exactly once and without any one target
    // or DC attached. The GM-side resolver performs all per-target comparisons
    // after the PF2e statistic roll has completed.
    return this.#executeStatistic({
      definition,
      actor,
      target: null,
      difficultyClass: undefined,
      statistic,
      event
    });
  }

  async execute({ definition, actor, target = null, difficultyClass, statistic = null, event = null }) {
    if (!definition?.execution?.enabled) {
      return { ok: false, reason: "not-enabled", results: [] };
    }
    if (!actor) return { ok: false, reason: "no-actor", results: [] };

    const mode = definition.execution.mode;
    if (mode === "activity") {
      return { ok: true, action: null, activity: true, results: [] };
    }
    if (mode === "exploration-activity") {
      return { ok: true, action: null, activity: true, explorationActivity: true, results: [] };
    }
    if (mode === "statistic") {
      return this.#executeStatistic({ definition, actor, target, difficultyClass, statistic, event });
    }

    const action = this.getSystemAction(definition);
    if (!action && mode === "system-or-statistic") {
      return this.#executeStatistic({ definition, actor, target, difficultyClass, statistic, event });
    }
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

  async #executeStatistic({ definition, actor, target, difficultyClass, statistic = null, event = null }) {
    const statisticSlug = statistic || definition.execution?.statistic;
    const pf2eStatistic = statisticSlug && typeof actor.getStatistic === "function"
      ? actor.getStatistic(statisticSlug)
      : null;
    if (!pf2eStatistic || typeof pf2eStatistic.roll !== "function") {
      return { ok: false, reason: "missing-statistic", results: [] };
    }

    try {
      let captured = null;
      const targetActor = actorFromTarget(target);
      const traits = visibilityEngine.getRollTraits(definition);
      const options = {
        action: definition.id,
        identifier: definition.id,
        title: game?.i18n?.localize?.(definition.label) ?? definition.id,
        createMessage: true,
        event: event ?? undefined,
        callback: (roll, outcome, message) => {
          captured = {
            roll,
            outcome: outcome ?? DEGREE_OF_SUCCESS[roll?.degreeOfSuccess] ?? "unknown",
            message
          };
        }
      };

      const rollMode = definition?.visibility?.roll ?? "public";
      const dcVisible = !definition?.dc?.hidden && !["blind", "gm"].includes(rollMode);
      if (Number.isFinite(Number(difficultyClass))) {
        options.dc = { value: Number(difficultyClass), visible: dcVisible };
      } else if (typeof difficultyClass === "string" && targetActor) {
        const defenseValue = resolveActorDefenseDc(targetActor, difficultyClass);
        if (Number.isFinite(defenseValue)) options.dc = { value: defenseValue, visible: dcVisible };
      } else if (difficultyClass !== undefined && difficultyClass !== null && typeof difficultyClass === "object") {
        options.dc = difficultyClass;
      }
      if (targetActor) options.target = targetActor;
      if (traits.length > 0) options.traits = traits;

      const roll = await pf2eStatistic.roll(options);
      if (!roll) return { ok: true, action: null, results: [] };

      const result = captured ?? {
        roll,
        outcome: DEGREE_OF_SUCCESS[roll.degreeOfSuccess] ?? "unknown",
        message: null
      };
      return { ok: true, action: null, results: [result] };
    } catch (error) {
      console.error("PF2E Action Forge | PF2e statistic execution failed", error);
      return { ok: false, reason: "execution-error", error, results: [] };
    }
  }
}

export const pf2eActionAdapter = new PF2eActionAdapter();
