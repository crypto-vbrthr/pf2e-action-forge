const MODULE_ID = "pf2e-action-forge";

export class ActionTransaction {
  static createId() {
    const randomId = globalThis.foundry?.utils?.randomID;
    if (typeof randomId === "function") return randomId(20);
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }

  static create({ definition, actor, targetEntry = null, outcome = "unknown", rollMessageId = null, difficultyClass = null, statistic = null } = {}) {
    return Object.freeze({
      id: this.createId(),
      actionId: definition?.id ?? null,
      sourceActorUuid: actor?.uuid ?? null,
      sourceActorName: actor?.name ?? "",
      targetActorUuid: targetEntry?.actor?.uuid ?? targetEntry?.actorUuid ?? null,
      targetActorName: targetEntry?.actor?.name ?? targetEntry?.name ?? "",
      targetTokenUuid: targetEntry?.token?.document?.uuid ?? targetEntry?.tokenUuid ?? null,
      targetSource: targetEntry?.source ?? null,
      outcome,
      difficultyClass: Number.isFinite(Number(difficultyClass)) ? Number(difficultyClass) : null,
      statistic: statistic ?? definition?.execution?.statistic ?? null,
      rollMessageId,
      createdBy: globalThis.game?.user?.id ?? null,
      createdAt: Date.now()
    });
  }
}

export { MODULE_ID };
