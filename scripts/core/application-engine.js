import { MODULE_ID } from "./action-transaction.js";
import { getActiveActionImmunity } from "./action-immunity.js";

export const APPLICATION_TYPES = new Set([
  "condition-add",
  "condition-increase",
  "condition-remove",
  "heal",
  "damage",
  "effect-add",
  "immunity"
]);

function cloneEffect(effect) {
  return effect ? { ...effect } : null;
}

function numeric(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveFormula(effect, transaction) {
  const dc = Number(transaction?.difficultyClass);
  if (effect?.formulaByDc && Number.isFinite(dc)) {
    const formula = effect.formulaByDc[String(dc)] ?? effect.formulaByDc[dc];
    if (formula) return String(formula);
  }
  return effect?.formula ? String(effect.formula) : null;
}

async function evaluateFormula(formula) {
  if (!formula || typeof globalThis.Roll !== "function") return null;
  const roll = await new Roll(formula).evaluate();
  const total = Number(roll?.total);
  return Number.isFinite(total) ? { roll, total } : null;
}

function findTargetToken(targetActor, explicitToken = null) {
  if (explicitToken) return explicitToken.document ?? explicitToken;
  try {
    return targetActor?.getActiveTokens?.(true, true)?.at?.(0)?.document ?? null;
  } catch (_error) {
    return null;
  }
}

export class ApplicationEngine {
  getEffects(definition, outcome) {
    const effects = definition?.application?.outcomes?.[outcome] ?? [];
    return effects
      .filter((effect) => effect?.id && APPLICATION_TYPES.has(effect?.type))
      .map(cloneEffect);
  }

  getEffect(definition, outcome, effectId) {
    return this.getEffects(definition, outcome).find((effect) => effect.id === effectId) ?? null;
  }

  hasApplications(definition, outcome) {
    return this.getEffects(definition, outcome).length > 0;
  }

  getActiveImmunity(targetActor, actionId, options = {}) {
    return getActiveActionImmunity(targetActor, actionId, options);
  }

  async apply({ effect, targetActor, sourceActor = null, targetToken = null, transactionId = null, transaction = null } = {}) {
    if (!effect || !APPLICATION_TYPES.has(effect.type)) {
      return { ok: false, reason: "unsupported-effect" };
    }
    if (!targetActor) return { ok: false, reason: "missing-target" };

    switch (effect.type) {
      case "condition-add":
        return this.#addCondition({ effect, targetActor, sourceActor, transactionId });
      case "condition-increase":
        return this.#increaseCondition({ effect, targetActor, sourceActor, transactionId });
      case "condition-remove":
        return this.#removeCondition({ effect, targetActor });
      case "heal":
        return this.#applyHitPoints({ effect, targetActor, targetToken, transaction, healing: true });
      case "damage":
        return this.#applyHitPoints({ effect, targetActor, targetToken, transaction, healing: false });
      case "immunity":
        return this.#addImmunity({ effect, targetActor, sourceActor, transactionId });
      default:
        return { ok: false, reason: "not-implemented" };
    }
  }

  async #addCondition({ effect, targetActor, sourceActor, transactionId }) {
    const slug = String(effect.condition ?? "").trim();
    if (!slug) return { ok: false, reason: "invalid-condition" };
    const desiredValue = Number.isFinite(Number(effect.value))
      ? Math.max(0, Math.trunc(Number(effect.value)))
      : null;

    try {
      const existing = targetActor.conditions?.bySlug?.(slug, { active: true, temporary: false })?.at?.(0)
        ?? targetActor.conditions?.bySlug?.(slug, { active: true })?.at?.(0)
        ?? null;
      if (existing) {
        if (desiredValue === null) {
          return { ok: true, reason: "already-present", changed: false, condition: slug };
        }

        const currentValue = Number(existing.value ?? existing.system?.value?.value ?? 0);
        if (Number.isFinite(currentValue) && currentValue >= desiredValue) {
          return { ok: true, reason: "already-at-least-value", changed: false, condition: slug, value: currentValue };
        }

        if (typeof existing.update === "function") {
          await existing.update({ "system.value.value": desiredValue });
          return { ok: true, changed: true, condition: slug, value: desiredValue, updatedId: existing.id ?? null };
        }
        // If an unusual synthetic condition cannot be updated, continue through
        // PF2e's normal creation path rather than silently reducing/ignoring the result.
      }

      const template = globalThis.game?.pf2e?.ConditionManager?.getCondition?.(slug);
      if (!template) return { ok: false, reason: "missing-condition-template" };

      if (typeof targetActor.isImmuneTo === "function") {
        try {
          if (targetActor.isImmuneTo(template)) return { ok: false, reason: "immune" };
        } catch (_error) {
          // Immunity checking is best-effort; PF2e still validates the created item.
        }
      }

      const source = template.toObject?.() ?? null;
      if (!source) return { ok: false, reason: "invalid-condition-template" };
      delete source._id;
      if (desiredValue !== null) {
        source.system = source.system ?? {};
        source.system.value = source.system.value ?? {};
        source.system.value.value = desiredValue;
      }
      source.flags = source.flags ?? {};
      source.flags[MODULE_ID] = {
        transactionId,
        sourceActorUuid: sourceActor?.uuid ?? null,
        applicationId: effect.id
      };

      const created = await targetActor.createEmbeddedDocuments?.("Item", [source]);
      if (!created) return { ok: false, reason: "create-failed" };
      return {
        ok: true,
        changed: true,
        condition: slug,
        value: desiredValue,
        createdIds: created.map((item) => item.id)
      };
    } catch (error) {
      console.error("PF2E Action Forge | Failed to apply condition", error);
      return { ok: false, reason: "apply-error", error };
    }
  }

  async #increaseCondition({ effect, targetActor, sourceActor, transactionId }) {
    const slug = String(effect.condition ?? "").trim();
    const delta = Number.isFinite(Number(effect.delta)) ? Math.trunc(Number(effect.delta)) : 1;
    if (!slug || delta <= 0) return { ok: false, reason: "invalid-condition" };

    try {
      const existing = targetActor.conditions?.bySlug?.(slug, { active: true, temporary: false })?.at?.(0)
        ?? targetActor.conditions?.bySlug?.(slug, { active: true })?.at?.(0)
        ?? null;
      if (!existing) {
        return this.#addCondition({
          effect: { ...effect, type: "condition-add", value: delta },
          targetActor,
          sourceActor,
          transactionId
        });
      }

      const currentValue = Number(existing.value ?? existing.system?.value?.value ?? 0);
      if (!Number.isFinite(currentValue) || currentValue < 0 || typeof existing.update !== "function") {
        return { ok: false, reason: "condition-not-valued" };
      }

      const nextValue = Math.max(0, Math.trunc(currentValue) + delta);
      await existing.update({ "system.value.value": nextValue });
      return {
        ok: true,
        changed: nextValue !== currentValue,
        condition: slug,
        value: nextValue,
        previousValue: currentValue,
        updatedId: existing.id ?? null
      };
    } catch (error) {
      console.error("PF2E Action Forge | Failed to increase condition", error);
      return { ok: false, reason: "apply-error", error };
    }
  }

  async #removeCondition({ effect, targetActor }) {
    const slug = String(effect.condition ?? "").trim();
    if (!slug) return { ok: false, reason: "invalid-condition" };
    const stored = targetActor.conditions?.bySlug?.(slug, { active: true, temporary: false }) ?? [];
    const ids = stored.map((condition) => condition.id).filter(Boolean);
    if (ids.length === 0) return { ok: true, reason: "not-present", changed: false, condition: slug };
    try {
      await targetActor.deleteEmbeddedDocuments?.("Item", ids);
      return { ok: true, changed: true, condition: slug, deletedIds: ids };
    } catch (error) {
      console.error("PF2E Action Forge | Failed to remove condition", error);
      return { ok: false, reason: "apply-error", error };
    }
  }

  async #applyHitPoints({ effect, targetActor, targetToken, transaction, healing }) {
    const formula = resolveFormula(effect, transaction);
    const evaluated = await evaluateFormula(formula);
    if (!evaluated) return { ok: false, reason: "invalid-formula" };

    const amount = Math.max(0, Math.trunc(evaluated.total));
    const token = findTargetToken(targetActor, targetToken);
    const startingHp = targetActor.system?.attributes?.hp ?? targetActor.hitPoints ?? null;
    const startingHpValue = Number.isFinite(Number(startingHp?.value)) ? numeric(startingHp.value) : null;
    const startingHpMax = Number.isFinite(Number(startingHp?.max)) ? numeric(startingHp.max) : null;

    try {
      // PF2e's Actor.applyDamage handles temporary HP, stamina, death automation,
      // and healing-received adjustments. Use it whenever a concrete token exists.
      if (token && typeof targetActor.applyDamage === "function") {
        await targetActor.applyDamage({
          damage: healing ? -amount : amount,
          token,
          final: true
        });

        let appliedValue = amount;
        if (healing && startingHpValue !== null) {
          const currentHp = targetActor.system?.attributes?.hp ?? targetActor.hitPoints ?? null;
          const currentValue = Number(currentHp?.value);
          if (Number.isFinite(currentValue) && currentValue !== startingHpValue) {
            appliedValue = Math.max(0, Math.trunc(currentValue - startingHpValue));
          } else if (startingHpMax !== null) {
            // Some synthetic/token Actor views do not immediately refresh their HP data
            // after applyDamage. In that case the maximum possible actual healing is still
            // known from the pre-application HP snapshot.
            appliedValue = Math.min(amount, Math.max(0, startingHpMax - startingHpValue));
          }
        }

        return { ok: true, changed: appliedValue > 0, value: amount, appliedValue, formula, healing };
      }

      // Sidebar-only Actors have no token for applyDamage. Use a conservative
      // document update fallback that still caps healing and consumes temp HP first.
      const hp = targetActor.system?.attributes?.hp ?? targetActor.hitPoints ?? null;
      if (!hp || !Number.isFinite(Number(hp.value)) || !Number.isFinite(Number(hp.max))) {
        return { ok: false, reason: "missing-hit-points" };
      }

      const updates = {};
      const hpValue = numeric(hp.value);
      const hpMax = numeric(hp.max);
      if (healing) {
        updates["system.attributes.hp.value"] = Math.min(hpMax, hpValue + amount);
      } else {
        let remaining = amount;
        const temp = numeric(hp.temp);
        if (temp > 0) {
          const absorbed = Math.min(temp, remaining);
          updates["system.attributes.hp.temp"] = temp - absorbed;
          remaining -= absorbed;
        }

        const sp = targetActor.system?.attributes?.hp?.sp ?? targetActor.attributes?.hp?.sp ?? null;
        const staminaEnabled = Boolean(globalThis.game?.pf2e?.settings?.variants?.stamina);
        if (staminaEnabled && sp && Number.isFinite(Number(sp.value)) && remaining > 0) {
          const stamina = numeric(sp.value);
          const absorbed = Math.min(stamina, remaining);
          updates["system.attributes.hp.sp.value"] = stamina - absorbed;
          remaining -= absorbed;
        }
        updates["system.attributes.hp.value"] = Math.max(0, hpValue - remaining);
      }

      await targetActor.update?.(updates, { damageTaken: healing ? -amount : amount });
      const next = Number(updates["system.attributes.hp.value"] ?? hpValue);
      const changed = next !== hpValue || "system.attributes.hp.temp" in updates || "system.attributes.hp.sp.value" in updates;
      const appliedValue = healing ? Math.max(0, Math.trunc(next - hpValue)) : amount;
      return { ok: true, changed, value: amount, appliedValue, formula, healing };
    } catch (error) {
      console.error("PF2E Action Forge | Failed to apply healing/damage", error);
      return { ok: false, reason: "apply-error", error };
    }
  }

  async #addImmunity({ effect, targetActor, sourceActor, transactionId }) {
    const actionId = String(effect.actionId ?? "").trim();
    const durationSeconds = Math.max(1, Math.trunc(numeric(effect.durationSeconds, 0)));
    if (!actionId || !durationSeconds) return { ok: false, reason: "invalid-immunity" };

    const existing = getActiveActionImmunity(targetActor, actionId, { sourceActor });
    if (existing) {
      return {
        ok: true,
        reason: "already-present",
        changed: false,
        immunityActionId: actionId,
        expiresAtWorldTime: existing.expiresAtWorldTime
      };
    }

    const now = numeric(globalThis.game?.time?.worldTime, 0);
    const expiresAtWorldTime = now + durationSeconds;
    const durationMinutes = durationSeconds / 60;
    const name = effect.name
      ? (globalThis.game?.i18n?.localize?.(effect.name) ?? effect.name)
      : actionId;
    const description = effect.description
      ? (globalThis.game?.i18n?.localize?.(effect.description) ?? effect.description)
      : "";

    const source = {
      name,
      type: "effect",
      img: "systems/pf2e/icons/default-icons/effect.svg",
      system: {
        description: { value: description },
        duration: {
          expiry: null,
          sustained: false,
          unit: Number.isInteger(durationMinutes) ? "minutes" : "seconds",
          value: Number.isInteger(durationMinutes) ? durationMinutes : durationSeconds
        },
        fromSpell: false,
        level: { value: 1 },
        rules: [],
        start: { initiative: null, value: now },
        tokenIcon: { show: true },
        traits: { value: [] }
      },
      flags: {
        [MODULE_ID]: {
          transactionId,
          sourceActorUuid: sourceActor?.uuid ?? null,
          applicationId: effect.id,
          immunity: {
            actionId,
            sourceSpecific: Boolean(effect.sourceSpecific),
            sourceActorUuid: sourceActor?.uuid ?? null,
            durationSeconds,
            expiresAtWorldTime
          }
        }
      }
    };

    try {
      const created = await targetActor.createEmbeddedDocuments?.("Item", [source]);
      if (!created) return { ok: false, reason: "create-failed" };
      return {
        ok: true,
        changed: true,
        immunityActionId: actionId,
        durationSeconds,
        expiresAtWorldTime,
        createdIds: created.map((item) => item.id)
      };
    } catch (error) {
      console.error("PF2E Action Forge | Failed to apply action immunity", error);
      return { ok: false, reason: "apply-error", error };
    }
  }
}

export { resolveFormula };
export const applicationEngine = new ApplicationEngine();
