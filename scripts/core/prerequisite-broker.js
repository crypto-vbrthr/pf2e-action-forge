import { actionRegistry } from "./action-registry.js";
import { canUserActWith } from "./actor-resolver.js";
import { prerequisiteValidator } from "./prerequisite-validator.js";
import { targetPickerService } from "./target-picker-service.js";

const MODULE_ID = "pf2e-action-forge";
const QUERY_NAME = `${MODULE_ID}.validatePrerequisites`;
const REQUEST_TIMEOUT = 10000;

function collectionValues(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (Array.isArray(collection.contents)) return collection.contents;
  try { return [...collection]; } catch (_error) { return []; }
}

function sanitize(result) {
  const entries = (result?.results ?? []).map((entry) => ({
    status: entry.status,
    code: entry.code,
    severity: entry.severity,
    message: entry.message,
    targetIndex: entry.targetIndex
  }));
  return {
    ok: Boolean(result?.ok),
    results: entries,
    hardFailures: entries.filter((entry) => entry.status === "fail" && entry.severity === "hard"),
    warnings: entries.filter((entry) => entry.status === "fail" && entry.severity === "advisory"),
    unresolved: entries.filter((entry) => entry.status === "unknown" && entry.severity === "hard")
  };
}

export class PrerequisiteBroker {
  #queryRegistered = false;

  registerQueryHandler() {
    if (this.#queryRegistered) return;
    const queries = globalThis.CONFIG?.queries;
    if (!queries) return;
    this.#queryRegistered = true;
    queries[QUERY_NAME] = async (queryData = {}) => {
      if (!globalThis.game?.user?.isGM) return { ok: false, reason: "not-gm" };
      return this.#process(queryData);
    };
  }

  getBrokers(users = globalThis.game?.users ?? []) {
    const activeGM = users?.activeGM ?? globalThis.game?.users?.activeGM ?? null;
    return collectionValues(users)
      .filter((user) => Boolean(user?.isGM && user?.active))
      .sort((a, b) => {
        if (activeGM?.id && a.id === activeGM.id) return -1;
        if (activeGM?.id && b.id === activeGM.id) return 1;
        return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
      });
  }

  isAvailable() {
    return Boolean(globalThis.game?.user?.isGM || this.getBrokers().some((broker) => typeof broker?.query === "function"));
  }

  async request({ definition, actor, targetState = null, statistic = null } = {}) {
    if (!definition?.id || !actor?.uuid) return { ok: false, reason: "invalid-request" };
    const payload = {
      requesterId: globalThis.game?.user?.id ?? null,
      actionId: definition.id,
      sourceActorUuid: actor.uuid,
      targetActorUuids: (targetState?.targets ?? []).map((entry) => entry?.actorUuid ?? entry?.actor?.uuid).filter(Boolean),
      statistic: statistic ?? null
    };

    if (globalThis.game?.user?.isGM) return this.#process(payload);

    const brokers = this.getBrokers().filter((broker) => typeof broker?.query === "function");
    if (!brokers.length) return { ok: false, reason: "no-active-gm" };
    for (const broker of brokers) {
      try {
        const result = await broker.query(QUERY_NAME, payload, { timeout: REQUEST_TIMEOUT });
        if (result) return result;
      } catch (error) {
        console.warn(`PF2E Action Forge | Prerequisite validation failed via GM ${broker?.id ?? "?"}`, error);
      }
    }
    return { ok: false, reason: "query-failed" };
  }

  async #process(payload = {}) {
    const requester = globalThis.game?.users?.get?.(payload.requesterId)
      ?? collectionValues(globalThis.game?.users).find((user) => user?.id === payload.requesterId);
    if (!requester) return { ok: false, reason: "unknown-requester" };

    const definition = actionRegistry.get(payload.actionId);
    if (!definition) return { ok: false, reason: "unknown-action" };

    const sourceActor = await this.#resolveActor(payload.sourceActorUuid);
    if (!sourceActor || !canUserActWith(sourceActor, requester)) return { ok: false, reason: "source-not-owned" };

    const targets = [];
    for (const actorUuid of payload.targetActorUuids ?? []) {
      const targetActor = await this.#resolveActor(actorUuid);
      if (!targetActor || !targetPickerService.isEligibleTarget(targetActor, requester)) {
        return { ok: false, reason: "invalid-target" };
      }
      targets.push({ actor: targetActor, actorUuid: targetActor.uuid });
    }

    const result = await prerequisiteValidator.validate(definition, {
      actor: sourceActor,
      targetState: { targets },
      statistic: payload.statistic ?? null,
      resolveTargets: false,
      unknownAsFailure: true
    });
    return { ...sanitize(result), reason: result.ok ? null : "prerequisite-failed" };
  }

  async #resolveActor(uuid) {
    if (!uuid) return null;
    if (typeof globalThis.fromUuid === "function") {
      try {
        const document = await globalThis.fromUuid(uuid);
        return document?.actor ?? document ?? null;
      } catch (_error) {
        return null;
      }
    }
    return null;
  }
}

export const prerequisiteBroker = new PrerequisiteBroker();
