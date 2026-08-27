const CRITICAL_FORGE_MODULE_ID = "pf2e-critical-forge";
const ENABLE_CRITICAL_FORGE_SETTING = "enableCriticalForge";

const SHARED_CRITICAL_CATEGORIES = Object.freeze({
  criticalSuccess: "skillCheckCriticalSuccess",
  criticalFailure: "skillCheckCriticalFailure"
});

function collectionValues(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return [...collection];
  if (Array.isArray(collection.contents)) return [...collection.contents];
  if (typeof collection.values === "function") {
    try { return [...collection.values()]; } catch (_error) { /* fall through */ }
  }
  try { return [...collection]; } catch (_error) { return []; }
}

function resolveMessage(messageId) {
  if (!messageId) return null;
  return globalThis.game?.messages?.get?.(messageId)
    ?? collectionValues(globalThis.game?.messages).find((message) => String(message?.id ?? message?._id ?? "") === String(messageId))
    ?? null;
}

async function resolveToken(tokenUuid) {
  if (!tokenUuid || typeof globalThis.fromUuid !== "function") return null;
  try {
    return await globalThis.fromUuid(tokenUuid);
  } catch (_error) {
    return null;
  }
}

function moduleApi() {
  const module = globalThis.game?.modules?.get?.(CRITICAL_FORGE_MODULE_ID)
    ?? collectionValues(globalThis.game?.modules).find((entry) => entry?.id === CRITICAL_FORGE_MODULE_ID)
    ?? null;
  if (!module?.active) return null;
  const api = module.api ?? null;
  if (!api?.cards?.capabilities?.skillCheckCriticals) return null;
  if (typeof api?.cards?.automation?.processMessage !== "function") return null;
  return api;
}

function criticalForgeEnabled() {
  try {
    return globalThis.game?.settings?.get?.(CRITICAL_FORGE_MODULE_ID, ENABLE_CRITICAL_FORGE_SETTING) !== false;
  } catch (_error) {
    // If an older/newer Critical Forge does not expose the setting in the expected
    // shape, capability detection remains the authoritative compatibility gate.
    return true;
  }
}

/**
 * Collapse one shared PF2e check into at most one Critical Forge event per
 * critical category. This prevents one roll against many observers from
 * producing a storm of duplicate critical cards.
 */
export function collectSharedCriticalGroups(resolutions = []) {
  const groups = [];
  for (const [outcome, category] of Object.entries(SHARED_CRITICAL_CATEGORIES)) {
    const targets = (Array.isArray(resolutions) ? resolutions : []).filter((entry) => entry?.outcome === outcome);
    if (targets.length === 0) continue;
    groups.push(Object.freeze({
      outcome,
      category,
      degreeOfSuccess: outcome === "criticalSuccess" ? 3 : 0,
      representative: targets[0],
      targets: Object.freeze([...targets])
    }));
  }
  return Object.freeze(groups);
}

/**
 * Optional bridge for Critical Forge 1.0.1-rc.5+ / API 0.9.7+.
 *
 * Normal Action Forge checks already generate native PF2e ChatMessages and are
 * therefore picked up by Critical Forge directly. Shared rolls are different:
 * PF2e creates one check without a DC, then Action Forge compares that immutable
 * result against several target DCs on the GM. This bridge feeds only the final
 * critical categories back into Critical Forge's public automation pipeline.
 */
export class CriticalForgeIntegration {
  #processed = new Set();

  isAvailable() {
    return Boolean(moduleApi() && criticalForgeEnabled());
  }

  async processSharedRoll({
    definition,
    sourceActor,
    snapshot,
    resolutions = [],
    rollMessageId = null,
    sourceMessage = null
  } = {}) {
    const api = moduleApi();
    if (!api) return { ok: true, skipped: true, reason: "critical-forge-unavailable", processed: [] };
    if (!criticalForgeEnabled()) return { ok: true, skipped: true, reason: "critical-forge-disabled", processed: [] };

    const skillType = String(definition?.execution?.statistic ?? "").trim();
    if (!skillType) return { ok: true, skipped: true, reason: "missing-skill", processed: [] };

    const groups = collectSharedCriticalGroups(resolutions);
    if (groups.length === 0) return { ok: true, skipped: true, reason: "no-critical-outcome", processed: [] };

    const actualMessage = sourceMessage ?? resolveMessage(rollMessageId);
    const baseMessageId = String(actualMessage?.id ?? actualMessage?._id ?? rollMessageId ?? `${Date.now()}`);
    const processed = [];

    for (const group of groups) {
      const key = `${baseMessageId}:${definition?.id ?? "action"}:${group.category}`;
      if (this.#processed.has(key)) {
        processed.push({ category: group.category, skipped: true, reason: "already-processed" });
        continue;
      }
      this.#processed.add(key);

      const representativeActor = group.representative?.targetActor ?? null;
      const representativeToken = await resolveToken(group.representative?.tokenUuid);
      const criticalTokens = (await Promise.all(group.targets.map((entry) => resolveToken(entry?.tokenUuid)))).filter(Boolean);
      const syntheticMessage = {
        id: `${baseMessageId}:action-forge:${group.category}`,
        _id: `${baseMessageId}:action-forge:${group.category}`,
        uuid: actualMessage?.uuid ?? null,
        speaker: actualMessage?.speaker
          ?? globalThis.ChatMessage?.getSpeaker?.({ actor: sourceActor })
          ?? { alias: sourceActor?.name ?? "" },
        author: actualMessage?.author ?? actualMessage?.user ?? globalThis.game?.user ?? null,
        user: actualMessage?.user ?? actualMessage?.author ?? globalThis.game?.user ?? null,
        flags: {}
      };

      const originalRoll = collectionValues(actualMessage?.rolls).at(-1) ?? actualMessage?.roll ?? null;
      const input = {
        message: actualMessage ?? syntheticMessage,
        roll: originalRoll,
        category: group.category,
        degreeOfSuccess: group.degreeOfSuccess,
        dieResult: snapshot?.dieResult ?? null,
        rollFamily: "skillCheck",
        rollType: "skill-check",
        identifier: skillType,
        action: definition?.id ?? null,
        skillType,
        actionSlug: definition?.id ?? null,
        rollOptions: [
          `check:statistic:${skillType}`,
          `action:slug:${definition?.id ?? "shared-roll"}`,
          "action-forge:shared-roll"
        ],
        sourceActor,
        targetActor: representativeActor,
        targetToken: representativeToken,
        targetTokens: criticalTokens
      };

      try {
        const result = await api.cards.automation.processMessage(syntheticMessage, {
          // Critical Forge explicitly supports injectable resolution collaborators
          // for advanced integrations. We keep its normal trigger/profile/history/
          // prompt/publication pipeline intact and only supply the resolved input.
          resolveMessageInput: async () => ({
            input,
            diagnostics: [{
              code: "ACTION_FORGE_SHARED_ROLL",
              severity: "info",
              data: {
                actionId: definition?.id ?? null,
                criticalTargetCount: group.targets.length,
                representativeTargetUuid: representativeActor?.uuid ?? group.representative?.actorUuid ?? null
              }
            }]
          }),
          // The synthetic message is not a persisted Foundry document. Action
          // Forge owns de-duplication for this bridge, so no source audit write is
          // attempted. Critical Forge still keeps its normal runtime guard/history.
          updateSourceMessage: async () => null
        });
        processed.push({
          category: group.category,
          targetCount: group.targets.length,
          representativeTargetUuid: representativeActor?.uuid ?? group.representative?.actorUuid ?? null,
          valid: Boolean(result?.valid),
          code: result?.code ?? null
        });
      } catch (error) {
        console.warn("PF2E Action Forge | Critical Forge shared-roll integration failed", error);
        processed.push({
          category: group.category,
          targetCount: group.targets.length,
          valid: false,
          code: "ACTION_FORGE_CRITICAL_FORGE_ERROR"
        });
      }
    }

    return { ok: true, skipped: false, processed };
  }
}

export const criticalForgeIntegration = new CriticalForgeIntegration();
