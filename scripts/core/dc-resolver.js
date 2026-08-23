const DC_STRATEGIES = new Set(["none", "manual", "target-defense", "fixed", "fixed-choice", "gm-defined"]);
const DEFENSES = new Set(["ac", "perception", "fortitude", "reflex", "will"]);

function normalizeManualDc(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 60 ? number : null;
}

export class DCResolver {
  getState(action, targetState, { manualDc = null } = {}) {
    const dc = action?.dc ?? { strategy: "none" };
    const strategy = DC_STRATEGIES.has(dc.strategy) ? dc.strategy : "none";
    const parsedManualDc = normalizeManualDc(manualDc);
    const target = targetState?.targets?.[0] ?? null;

    switch (strategy) {
      case "none":
        return {
          strategy,
          valid: true,
          source: "none",
          difficultyClass: undefined,
          target: null,
          manualDc: parsedManualDc,
          needsManualDc: false,
          allowsManualDc: false,
          labelKey: "PF2EActionForge.DC.None"
        };

      case "manual":
        return {
          strategy,
          valid: parsedManualDc !== null,
          source: "manual",
          difficultyClass: parsedManualDc ?? undefined,
          target: null,
          manualDc: parsedManualDc,
          needsManualDc: parsedManualDc === null,
          allowsManualDc: true,
          labelKey: "PF2EActionForge.DC.Manual"
        };

      case "target-defense": {
        const defense = DEFENSES.has(dc.defense) ? dc.defense : null;
        if (!defense) {
          return {
            strategy,
            valid: false,
            source: "invalid",
            difficultyClass: undefined,
            target,
            manualDc: parsedManualDc,
            needsManualDc: false,
            allowsManualDc: Boolean(dc.manualFallback),
            labelKey: "PF2EActionForge.DC.Invalid"
          };
        }

        if (target) {
          return {
            strategy,
            valid: true,
            source: "target",
            difficultyClass: defense,
            defense,
            target,
            manualDc: parsedManualDc,
            needsManualDc: false,
            allowsManualDc: Boolean(dc.manualFallback),
            labelKey: `PF2EActionForge.DC.Defense.${defense}`
          };
        }

        const manualFallback = Boolean(dc.manualFallback);
        return {
          strategy,
          valid: manualFallback && parsedManualDc !== null,
          source: manualFallback ? "manual" : "missing-target",
          difficultyClass: manualFallback && parsedManualDc !== null ? parsedManualDc : undefined,
          defense,
          target: null,
          manualDc: parsedManualDc,
          needsManualDc: manualFallback && parsedManualDc === null,
          allowsManualDc: manualFallback,
          labelKey: manualFallback
            ? "PF2EActionForge.DC.ManualFallback"
            : `PF2EActionForge.DC.Defense.${defense}`
        };
      }

      case "fixed": {
        const value = normalizeManualDc(dc.value);
        return {
          strategy,
          valid: value !== null,
          source: "fixed",
          difficultyClass: value ?? undefined,
          target,
          manualDc: parsedManualDc,
          needsManualDc: false,
          allowsManualDc: false,
          labelKey: "PF2EActionForge.DC.Fixed"
        };
      }

      case "fixed-choice": {
        const choices = Array.isArray(dc.choices)
          ? dc.choices.map(normalizeManualDc).filter((value) => value !== null)
          : [];
        const selected = choices.includes(parsedManualDc) ? parsedManualDc : choices[0] ?? null;
        return {
          strategy,
          valid: selected !== null,
          source: "fixed-choice",
          difficultyClass: selected ?? undefined,
          target,
          manualDc: selected,
          choices,
          needsManualDc: false,
          allowsManualDc: false,
          labelKey: "PF2EActionForge.DC.FixedChoice"
        };
      }

      case "gm-defined":
      default:
        return {
          strategy,
          valid: parsedManualDc !== null,
          source: "manual",
          difficultyClass: parsedManualDc ?? undefined,
          target,
          manualDc: parsedManualDc,
          needsManualDc: parsedManualDc === null,
          allowsManualDc: true,
          labelKey: "PF2EActionForge.DC.GMDefined"
        };
    }
  }

  resolve(action, targetState, options = {}) {
    const state = this.getState(action, targetState, options);
    if (!state.valid) return { ok: false, state };

    const target = state.target?.token ?? state.target?.actor ?? null;
    return {
      ok: true,
      state,
      difficultyClass: state.difficultyClass,
      target
    };
  }
}

export { normalizeManualDc };
export const dcResolver = new DCResolver();
