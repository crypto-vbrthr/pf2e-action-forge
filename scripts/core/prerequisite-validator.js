import { statisticRank } from "./dc-resolver.js";

function collectionValues(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (Array.isArray(collection.contents)) return collection.contents;
  try { return [...collection]; } catch (_error) { return []; }
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function itemTokens(item) {
  return new Set([
    item?.slug,
    item?.system?.slug,
    item?._source?.slug,
    item?._source?.system?.slug,
    item?.name
  ].map(normalize).filter(Boolean));
}

function actorItems(actor) {
  return collectionValues(actor?.items);
}

function itemMatchesUsage(item, usage) {
  if (!usage || usage === "carried") return true;
  const equipped = item?.system?.equipped ?? {};
  const carryType = normalize(equipped.carryType ?? item?.system?.usage?.type ?? item?.system?.usage ?? "");
  const handsHeld = numeric(equipped.handsHeld ?? item?.system?.equipped?.handsHeld) ?? 0;
  if (usage === "held") return handsHeld > 0 || carryType === "held";
  if (usage === "worn") return Boolean(equipped.inSlot || equipped.invested) || carryType === "worn" || carryType === "equipped";
  if (usage === "held-or-worn") {
    return handsHeld > 0 || ["held", "worn", "equipped"].includes(carryType) || Boolean(equipped.inSlot || equipped.invested);
  }
  return true;
}

function hasItem(actor, aliases = [], usage = null) {
  const wanted = aliases.map(normalize).filter(Boolean);
  if (!wanted.length) return true;
  return actorItems(actor).some((item) => {
    const tokens = itemTokens(item);
    const matches = wanted.some((candidate) => [...tokens].some((token) => token === candidate || token.includes(candidate) || candidate.includes(token)));
    return matches && itemMatchesUsage(item, usage);
  });
}

function hasFeature(actor, aliases = []) {
  return hasItem(actor, aliases, null);
}

function actorTraits(actor) {
  const values = actor?.system?.traits?.value ?? actor?.traits ?? [];
  if (values instanceof Set) return new Set([...values].map(normalize));
  if (Array.isArray(values)) return new Set(values.map(normalize));
  if (values && typeof values === "object") return new Set(Object.keys(values).filter((key) => values[key]).map(normalize));
  return new Set();
}

function hasTrait(actor, trait) {
  return actorTraits(actor).has(normalize(trait));
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getSpeed(actor, speed) {
  const slug = normalize(speed);
  const attributes = actor?.system?.attributes ?? {};
  const speedData = attributes.speed ?? {};

  if (slug === "land" || slug === "ground") {
    return numeric(speedData.value ?? actor?.movement?.walk ?? actor?.system?.movement?.walk);
  }

  for (const entry of [
    ...collectionValues(speedData.other),
    ...collectionValues(speedData.otherSpeeds),
    ...collectionValues(actor?.system?.movement?.other)
  ]) {
    if (normalize(entry?.type ?? entry?.slug ?? entry?.label) !== slug) continue;
    const value = numeric(entry?.value ?? entry?.total ?? entry?.speed);
    if (value !== null) return value;
  }

  for (const candidate of [
    speedData?.[slug]?.value,
    speedData?.[slug],
    actor?.movement?.[slug],
    actor?.system?.movement?.[slug]
  ]) {
    const value = numeric(candidate?.value ?? candidate);
    if (value !== null) return value;
  }

  return null;
}

function conditionItems(actor) {
  return [
    ...collectionValues(actor?.conditions),
    ...actorItems(actor).filter((item) => item?.type === "condition")
  ];
}

function getCondition(actor, slug) {
  const wanted = normalize(slug);
  let bySlug = null;
  try {
    bySlug = actor?.conditions?.bySlug?.(slug, { active: true })?.at?.(0)
      ?? actor?.conditions?.bySlug?.(slug)?.at?.(0)
      ?? null;
  } catch (_error) {
    bySlug = null;
  }
  if (bySlug) return bySlug;
  const direct = actor?.conditions?.get?.(wanted) ?? actor?.conditions?.get?.(slug) ?? null;
  if (direct) return direct;
  return conditionItems(actor).find((condition) => {
    const values = [condition?.slug, condition?.system?.slug, condition?.name].map(normalize);
    return values.includes(wanted);
  }) ?? null;
}

function conditionValue(condition) {
  return numeric(
    condition?.value
    ?? condition?.system?.value?.value
    ?? condition?.system?.value
    ?? condition?.system?.badge?.value
    ?? condition?.badge?.value
  ) ?? 0;
}

function hasPersistentBleed(actor) {
  const conditions = conditionItems(actor);
  for (const condition of conditions) {
    const slug = normalize(condition?.slug ?? condition?.system?.slug ?? condition?.name);
    const persistentType = normalize(
      condition?.system?.persistent?.damageType
      ?? condition?.system?.persistent?.type
      ?? condition?.system?.damageType
      ?? condition?.system?.damage?.damageType
      ?? condition?.system?.damage?.type
    );
    const name = normalize(condition?.name);
    if ((slug.includes("persistent") || name.includes("persistent") || name.includes("anhaltend"))
        && (persistentType === "bleed" || name.includes("bleed") || name.includes("blutung"))) {
      return true;
    }
    if (slug.includes("persistent-bleed") || slug.includes("persistent-damage-bleed")) return true;
  }
  return false;
}

function hpState(actor) {
  const hp = actor?.system?.attributes?.hp ?? actor?.hitPoints ?? null;
  if (!hp) return { known: false, value: null, max: null };
  const value = numeric(hp.value ?? hp.current);
  const max = numeric(hp.max);
  return { known: value !== null && max !== null, value, max };
}

function isLiving(actor) {
  if (!actor) return null;
  const traits = actorTraits(actor);
  if (traits.has("undead")) return false;
  if (actor?.system?.attributes?.hp?.negativeHealing === true) return false;
  if (actor?.system?.attributes?.hp?.negativeHealing === false) return true;
  // PF2e creature actors without an explicit undead marker are treated as living.
  // This intentionally avoids rejecting unusual living constructs or ancestries.
  return true;
}

function targetActors(targetState) {
  return (targetState?.targets ?? []).map((entry) => entry?.actor ?? null);
}

async function resolveTargetActors(targetState) {
  const result = [];
  for (const entry of targetState?.targets ?? []) {
    if (entry?.actor) {
      result.push(entry.actor);
      continue;
    }
    if (entry?.actorUuid && typeof globalThis.fromUuid === "function") {
      try {
        const actor = await globalThis.fromUuid(entry.actorUuid);
        result.push(actor ?? null);
        continue;
      } catch (_error) {
        // Keep unresolved below.
      }
    }
    result.push(null);
  }
  return result;
}

function resultFor(prerequisite, status, code, { targetIndex = null } = {}) {
  return Object.freeze({
    status,
    code,
    severity: prerequisite?.severity === "advisory" ? "advisory" : "hard",
    message: prerequisite?.message ? String(prerequisite.message) : null,
    targetIndex
  });
}

function validateAgainstActor(prerequisite, actor, { statistic = null, targetIndex = null, targets = [] } = {}) {
  switch (prerequisite?.type) {
    case "item": {
      if (!actor || actorItems(actor) === null) return resultFor(prerequisite, "unknown", "item-unresolved", { targetIndex });
      if (hasItem(actor, prerequisite.slugs ?? [], prerequisite.usage)) {
        return resultFor(prerequisite, "pass", "item", { targetIndex });
      }
      if ((prerequisite.sourceWaiverSlugs ?? []).length && hasFeature(actor, prerequisite.sourceWaiverSlugs)) {
        return resultFor(prerequisite, "pass", "item-waived-source", { targetIndex });
      }
      if ((prerequisite.targetWaiverSlugs ?? []).length) {
        if (!targets.length || targets.some((target) => !target)) {
          return resultFor(prerequisite, "unknown", "item-waiver-target-unresolved", { targetIndex });
        }
        if (targets.every((target) => hasFeature(target, prerequisite.targetWaiverSlugs))) {
          return resultFor(prerequisite, "pass", "item-waived-target", { targetIndex });
        }
      }
      return resultFor(prerequisite, "fail", "item", { targetIndex });
    }
    case "movement-speed": {
      if (!actor) return resultFor(prerequisite, "unknown", "speed-unresolved", { targetIndex });
      const value = getSpeed(actor, prerequisite.speed);
      if (value === null) return resultFor(prerequisite, "fail", "movement-speed", { targetIndex });
      return resultFor(prerequisite, value >= Number(prerequisite.min ?? 1) ? "pass" : "fail", "movement-speed", { targetIndex });
    }
    case "statistic-rank": {
      if (!actor) return resultFor(prerequisite, "unknown", "statistic-unresolved", { targetIndex });
      const slug = prerequisite.statistic === "$selected" ? statistic : prerequisite.statistic;
      const rank = statisticRank(actor, slug);
      if (rank === null) return resultFor(prerequisite, "unknown", "statistic-unresolved", { targetIndex });
      return resultFor(prerequisite, rank >= Number(prerequisite.minRank ?? 0) ? "pass" : "fail", "statistic-rank", { targetIndex });
    }
    case "target-trait": {
      if (!actor) return resultFor(prerequisite, "unknown", "target-unresolved", { targetIndex });
      return resultFor(prerequisite, hasTrait(actor, prerequisite.trait) ? "pass" : "fail", "target-trait", { targetIndex });
    }
    case "target-state": {
      if (!actor) return resultFor(prerequisite, "unknown", "target-unresolved", { targetIndex });
      const state = prerequisite.state;
      if (state === "dying") {
        const dying = getCondition(actor, "dying");
        const hp = hpState(actor);
        const valid = Boolean(dying && conditionValue(dying) > 0 && (!hp.known || hp.value <= 0));
        return resultFor(prerequisite, valid ? "pass" : "fail", "target-dying", { targetIndex });
      }
      if (state === "persistent-bleed") {
        return resultFor(prerequisite, hasPersistentBleed(actor) ? "pass" : "fail", "target-persistent-bleed", { targetIndex });
      }
      if (state === "living-wounded") {
        const living = isLiving(actor);
        const hp = hpState(actor);
        const wounded = getCondition(actor, "wounded");
        const damaged = hp.known ? hp.value < hp.max : null;
        const hasWounded = Boolean(wounded && conditionValue(wounded) > 0);
        if (living === false) return resultFor(prerequisite, "fail", "target-living-wounded", { targetIndex });
        if (damaged === null) return resultFor(prerequisite, "unknown", "target-hp-unresolved", { targetIndex });
        return resultFor(prerequisite, damaged || hasWounded ? "pass" : "fail", "target-living-wounded", { targetIndex });
      }
      return resultFor(prerequisite, "unknown", "unsupported-target-state", { targetIndex });
    }
    case "target-statistic-rank": {
      if (!actor) return resultFor(prerequisite, "unknown", "target-unresolved", { targetIndex });
      const slug = prerequisite.statistic === "$selected" ? statistic : prerequisite.statistic;
      const rank = statisticRank(actor, slug);
      if (rank === null) return resultFor(prerequisite, "unknown", "target-statistic-rank", { targetIndex });
      return resultFor(prerequisite, rank >= Number(prerequisite.minRank ?? 0) ? "pass" : "fail", "target-statistic-rank", { targetIndex });
    }
    default:
      return resultFor(prerequisite, "unknown", "unsupported-prerequisite", { targetIndex });
  }
}

/**
 * Declarative PF2e prerequisite validation shared by UI and privileged brokers.
 *
 * Hard failures block execution. Advisory failures are surfaced as warnings.
 * Unknown hard requirements are returned separately so a caller can ask an
 * authoritative GM to resolve opaque targets without exposing target statistics.
 */
export class PrerequisiteValidator {
  async validate(definition, { actor = null, targetState = null, statistic = null, resolveTargets = true, unknownAsFailure = false } = {}) {
    const prerequisites = definition?.prerequisites ?? [];
    if (!prerequisites.length) {
      return Object.freeze({ ok: true, results: Object.freeze([]), hardFailures: Object.freeze([]), warnings: Object.freeze([]), unresolved: Object.freeze([]) });
    }

    const resolvedTargets = resolveTargets ? await resolveTargetActors(targetState) : targetActors(targetState);
    const results = [];

    for (const prerequisite of prerequisites) {
      const isTarget = String(prerequisite?.type ?? "").startsWith("target-");
      if (isTarget) {
        if (!resolvedTargets.length) {
          results.push(resultFor(prerequisite, "unknown", "target-unresolved"));
          continue;
        }
        resolvedTargets.forEach((targetActor, index) => {
          results.push(validateAgainstActor(prerequisite, targetActor, { statistic, targetIndex: index, targets: resolvedTargets }));
        });
      } else {
        results.push(validateAgainstActor(prerequisite, actor, { statistic, targets: resolvedTargets }));
      }
    }

    const hardFailures = results.filter((entry) => entry.severity === "hard" && (entry.status === "fail" || (unknownAsFailure && entry.status === "unknown")));
    const warnings = results.filter((entry) => entry.status === "fail" && entry.severity === "advisory");
    const unresolved = unknownAsFailure ? [] : results.filter((entry) => entry.status === "unknown" && entry.severity === "hard");
    return Object.freeze({
      ok: hardFailures.length === 0 && unresolved.length === 0,
      results: Object.freeze(results),
      hardFailures: Object.freeze(hardFailures),
      warnings: Object.freeze(warnings),
      unresolved: Object.freeze(unresolved)
    });
  }
}

export { actorTraits, getCondition, getSpeed, hasFeature, hasItem, hasPersistentBleed, hpState, isLiving };
export const prerequisiteValidator = new PrerequisiteValidator();
