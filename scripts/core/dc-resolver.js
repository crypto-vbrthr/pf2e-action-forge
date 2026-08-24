const DC_STRATEGIES = new Set(["none", "manual", "target-defense", "target-dying", "fixed", "fixed-choice", "gm-defined"]);
const DEFENSES = new Set(["ac", "perception", "fortitude", "reflex", "will", "athletics", "deception", "thievery"]);

function normalizeManualDc(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 60 ? number : null;
}

function statisticRank(actor, statistic) {
  if (!actor || !statistic) return null;
  const candidates = [
    actor.skills?.[statistic]?.rank,
    actor.getStatistic?.(statistic)?.rank,
    actor.getStatistic?.(statistic)?.proficiency?.rank
  ];
  for (const candidate of candidates) {
    const rank = Number(candidate);
    if (Number.isInteger(rank) && rank >= 0 && rank <= 4) return rank;
  }
  return null;
}

function normalizeChoice(choice) {
  if (typeof choice === "number") {
    const value = normalizeManualDc(choice);
    return value === null ? null : { value, minRank: 0, label: null };
  }
  if (!choice || typeof choice !== "object") return null;
  const value = normalizeManualDc(choice.value);
  if (value === null) return null;
  const minRank = Number.isInteger(Number(choice.minRank)) ? Math.max(0, Math.min(4, Number(choice.minRank))) : 0;
  return { value, minRank, label: choice.label ?? null };
}

/**
 * Resolve a prepared PF2e defense DC directly from an Actor.
 *
 * PF2e's action API can resolve a defense slug from an explicit Actor target in
 * current versions. We still resolve a numeric DC for Actor-only/sidebar
 * targets as a compatibility hardening measure: older action implementations
 * can otherwise fall back to game.user.targets and accidentally use a stale
 * canvas token (or no DC at all when no token is targeted).
 */
function resolveActorDefenseDc(actor, defense) {
  if (!actor || !DEFENSES.has(defense)) return null;

  try {
    const statistic = actor.getStatistic?.(defense);
    const value = statistic?.dc?.value;
    if (Number.isFinite(value)) return Number(value);
  } catch (_error) {
    // Continue through stable prepared-data fallbacks below.
  }

  const candidates = (() => {
    switch (defense) {
      case "perception":
        return [actor.perception?.dc?.value, actor.system?.perception?.dc, actor.system?.attributes?.perception?.dc];
      case "fortitude":
      case "reflex":
      case "will":
        return [
          actor.saves?.[defense]?.dc?.value,
          actor.system?.saves?.[defense]?.dc,
          actor.system?.saves?.[defense]?.value
        ];
      case "ac":
        return [actor.armorClass?.value, actor.system?.attributes?.ac?.value, actor.system?.attributes?.ac?.dc];
      default:
        return [];
    }
  })();

  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function resolveDyingValue(actor) {
  if (!actor) return null;
  let condition = null;
  try {
    condition = actor.conditions?.bySlug?.("dying", { active: true })?.at?.(0)
      ?? actor.conditions?.get?.("dying")
      ?? null;
  } catch (_error) {
    condition = null;
  }

  const candidates = [
    condition?.value,
    condition?.system?.value?.value,
    actor.system?.attributes?.dying?.value,
    actor.attributes?.dying?.value
  ];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isInteger(value) && value > 0) return value;
  }
  return null;
}

export class DCResolver {
  getState(action, targetState, { manualDc = null, statistic = null, actor = null, user = globalThis.game?.user ?? null } = {}) {
    const dc = action?.dc ?? { strategy: "none" };
    const strategy = DC_STRATEGIES.has(dc.strategy) ? dc.strategy : "none";
    const parsedManualDc = normalizeManualDc(manualDc);
    const target = targetState?.targets?.[0] ?? null;
    const canSetGmDefinedDc = Boolean(user?.isGM);

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

        const hasResolvableTarget = Boolean(target?.token || target?.actor);
        if (target && hasResolvableTarget) {
          // Token targets retain the defense slug so PF2e can build the full
          // origin/target context itself. Actor-only targets (sidebar drops)
          // get a concrete prepared DC to avoid any fallback to a different
          // token in game.user.targets.
          const actorOnlyTarget = !target.token && target.actor;
          const resolvedDefenseDc = actorOnlyTarget ? resolveActorDefenseDc(target.actor, defense) : null;
          return {
            strategy,
            valid: true,
            source: "target",
            difficultyClass: resolvedDefenseDc ?? defense,
            defense,
            defenseValue: resolvedDefenseDc,
            target,
            manualDc: parsedManualDc,
            needsManualDc: false,
            allowsManualDc: Boolean(dc.manualFallback),
            labelKey: `PF2EActionForge.DC.Defense.${defense}`
          };
        }

        if (dc.allowUnknown) {
          if (canSetGmDefinedDc && parsedManualDc !== null) {
            return {
              strategy,
              valid: true,
              source: "manual",
              difficultyClass: parsedManualDc,
              defense,
              target,
              manualDc: parsedManualDc,
              needsManualDc: false,
              allowsManualDc: true,
              requiresGmHandoff: false,
              labelKey: "PF2EActionForge.DC.GMSecret"
            };
          }
          if (canSetGmDefinedDc) {
            return {
              strategy,
              valid: false,
              source: "gm",
              difficultyClass: undefined,
              defense,
              target,
              manualDc: null,
              needsManualDc: true,
              allowsManualDc: true,
              requiresGmHandoff: false,
              labelKey: "PF2EActionForge.DC.GMSecret"
            };
          }
          return {
            strategy,
            valid: true,
            source: "gm",
            difficultyClass: undefined,
            defense,
            target,
            manualDc: null,
            needsManualDc: false,
            allowsManualDc: false,
            requiresGmHandoff: true,
            labelKey: "PF2EActionForge.DC.GMSecret"
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

      case "target-dying": {
        const targetActor = target?.actor ?? target?.token?.actor ?? null;
        const dyingValue = resolveDyingValue(targetActor);
        if (dyingValue !== null) {
          const value = 15 + dyingValue;
          return {
            strategy,
            valid: true,
            source: "target-dying",
            difficultyClass: value,
            target,
            dyingValue,
            manualDc: parsedManualDc,
            needsManualDc: false,
            allowsManualDc: false,
            labelKey: "PF2EActionForge.DC.DyingRecovery"
          };
        }

        // A locally readable target without Dying is not a hidden-information
        // case: First Aid (stabilize) simply is not applicable to that target.
        if (targetActor) {
          return {
            strategy,
            valid: false,
            source: "missing-dying",
            difficultyClass: undefined,
            target,
            manualDc: parsedManualDc,
            needsManualDc: false,
            allowsManualDc: false,
            labelKey: "PF2EActionForge.DC.DyingRequired"
          };
        }

        // Picker-only targets may intentionally be opaque to the player. In that
        // case reuse the existing GM handoff rather than exposing target state.
        if (dc.allowUnknown && target) {
          if (canSetGmDefinedDc && parsedManualDc !== null) {
            return {
              strategy,
              valid: true,
              source: "manual",
              difficultyClass: parsedManualDc,
              target,
              manualDc: parsedManualDc,
              needsManualDc: false,
              allowsManualDc: true,
              requiresGmHandoff: false,
              labelKey: "PF2EActionForge.DC.DyingRecovery"
            };
          }
          if (canSetGmDefinedDc) {
            return {
              strategy,
              valid: false,
              source: "gm",
              difficultyClass: undefined,
              target,
              manualDc: null,
              needsManualDc: true,
              allowsManualDc: true,
              requiresGmHandoff: false,
              labelKey: "PF2EActionForge.DC.DyingRecovery"
            };
          }
          return {
            strategy,
            valid: true,
            source: "gm",
            difficultyClass: undefined,
            target,
            manualDc: null,
            needsManualDc: false,
            allowsManualDc: false,
            requiresGmHandoff: true,
            labelKey: "PF2EActionForge.DC.DyingRecovery"
          };
        }

        return {
          strategy,
          valid: false,
          source: "missing-dying",
          difficultyClass: undefined,
          target,
          manualDc: parsedManualDc,
          needsManualDc: false,
          allowsManualDc: false,
          labelKey: "PF2EActionForge.DC.DyingRequired"
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
        const allEntries = Array.isArray(dc.choices)
          ? dc.choices.map(normalizeChoice).filter(Boolean)
          : [];
        const rank = statisticRank(actor, statistic ?? action?.execution?.statistic);
        const choiceEntries = rank === null
          ? allEntries
          : allEntries.filter((entry) => entry.minRank <= rank);
        const choices = choiceEntries.map((entry) => entry.value);
        const allowCustom = Boolean(dc.allowCustom);
        const selected = parsedManualDc !== null && (allowCustom || choices.includes(parsedManualDc))
          ? parsedManualDc
          : choices[0] ?? null;
        const custom = selected !== null && !choices.includes(selected);
        return {
          strategy,
          valid: selected !== null,
          source: custom ? "fixed-choice-custom" : "fixed-choice",
          difficultyClass: selected ?? undefined,
          target,
          manualDc: selected,
          choices,
          choiceEntries,
          statisticRank: rank,
          custom,
          needsManualDc: false,
          allowsManualDc: allowCustom,
          labelKey: "PF2EActionForge.DC.FixedChoice"
        };
      }

      case "gm-defined":
      default: {
        const systemTargetStatistics = Array.isArray(dc.systemTargetStatistics) ? dc.systemTargetStatistics : [];
        const targetStatisticMatches = (() => {
          if (!dc.systemTargetRequiresStatisticMatch) return true;
          const skills = target?.actor?.identificationDCs?.skills;
          return Boolean(skills?.has?.(statistic));
        })();
        const canUseSystemTarget = Boolean(
          dc.systemTargetFallback &&
          target?.actor?.type === "npc" &&
          statistic &&
          systemTargetStatistics.includes(statistic) &&
          targetStatisticMatches
        );

        if (canSetGmDefinedDc && parsedManualDc !== null) {
          return {
            strategy,
            valid: true,
            source: "manual",
            difficultyClass: parsedManualDc,
            target,
            manualDc: parsedManualDc,
            needsManualDc: false,
            allowsManualDc: true,
            labelKey: "PF2EActionForge.DC.GMDefined"
          };
        }

        if (canUseSystemTarget) {
          return {
            strategy,
            valid: true,
            source: "system-target",
            difficultyClass: undefined,
            target,
            manualDc: null,
            needsManualDc: false,
            allowsManualDc: canSetGmDefinedDc,
            labelKey: "PF2EActionForge.DC.SystemTarget"
          };
        }

        if (dc.allowUnknown) {
          if (canSetGmDefinedDc) {
            return {
              strategy,
              valid: false,
              source: "gm",
              difficultyClass: undefined,
              target,
              manualDc: null,
              needsManualDc: true,
              allowsManualDc: true,
              requiresGmHandoff: false,
              labelKey: "PF2EActionForge.DC.GMSecret"
            };
          }

          return {
            strategy,
            valid: true,
            source: "gm",
            difficultyClass: undefined,
            target,
            manualDc: null,
            needsManualDc: false,
            allowsManualDc: false,
            requiresGmHandoff: true,
            labelKey: "PF2EActionForge.DC.GMSecret"
          };
        }

        return {
          strategy,
          valid: false,
          source: "manual",
          difficultyClass: undefined,
          target,
          manualDc: null,
          needsManualDc: canSetGmDefinedDc,
          allowsManualDc: canSetGmDefinedDc,
          labelKey: "PF2EActionForge.DC.GMDefined"
        };
      }
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

export { normalizeManualDc, resolveActorDefenseDc, resolveDyingValue, statisticRank };
export const dcResolver = new DCResolver();
