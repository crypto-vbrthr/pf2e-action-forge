function normalizeDc(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 60 ? number : null;
}

function escapeHtml(value) {
  const text = String(value ?? "");
  const escape = globalThis.foundry?.utils?.escapeHTML;
  if (typeof escape === "function") return escape(text);
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Requests a secret, GM-defined DC from one deterministic active GM.
 *
 * Foundry v14's DialogV2.query can present an asynchronous input dialog to a
 * specific connected User. Action Forge deliberately uses only the first
 * active GM (sorted by id), so multiple connected GMs cannot race to answer
 * the same request.
 */
export class GmDcHandoff {
  getBroker(users = globalThis.game?.users ?? []) {
    const activeGms = [...users]
      .filter((user) => Boolean(user?.isGM && user?.active))
      .sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")));
    return activeGms[0] ?? null;
  }

  isAvailable(users = globalThis.game?.users ?? []) {
    return Boolean(this.getBroker(users));
  }

  createRequestId() {
    const randomId = globalThis.foundry?.utils?.randomID;
    if (typeof randomId === "function") return randomId();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  async request({ definition, actor, target = null, statisticLabel = "", requestId = null } = {}) {
    const broker = this.getBroker();
    if (!broker) return { ok: false, reason: "no-active-gm", requestId };

    const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    if (typeof DialogV2?.query !== "function") {
      return { ok: false, reason: "dialog-query-unavailable", requestId, gmId: broker.id };
    }

    const actionName = globalThis.game?.i18n?.localize?.(definition?.label) ?? definition?.id ?? "Action";
    const targetName = target?.name ?? target?.actor?.name ?? "—";
    const content = `
      <div class="af-gm-dc-query">
        <p>${escapeHtml(globalThis.game?.i18n?.localize?.("PF2EActionForge.GMDC.RequestIntro") ?? "A player action requires a secret DC.")}</p>
        <dl>
          <div><dt>${escapeHtml(globalThis.game?.i18n?.localize?.("PF2EActionForge.GMDC.Action") ?? "Action")}</dt><dd>${escapeHtml(actionName)}</dd></div>
          <div><dt>${escapeHtml(globalThis.game?.i18n?.localize?.("PF2EActionForge.GMDC.Actor") ?? "Actor")}</dt><dd>${escapeHtml(actor?.name ?? "—")}</dd></div>
          <div><dt>${escapeHtml(globalThis.game?.i18n?.localize?.("PF2EActionForge.GMDC.Target") ?? "Target")}</dt><dd>${escapeHtml(targetName)}</dd></div>
          <div><dt>${escapeHtml(globalThis.game?.i18n?.localize?.("PF2EActionForge.GMDC.Statistic") ?? "Statistic")}</dt><dd>${escapeHtml(statisticLabel || "—")}</dd></div>
        </dl>
        <label class="af-gm-dc-query-input">
          <span>${escapeHtml(globalThis.game?.i18n?.localize?.("PF2EActionForge.GMDC.DC") ?? "DC")}</span>
          <input name="dc" type="number" min="0" max="60" step="1" required autofocus />
        </label>
      </div>`;

    let response;
    try {
      response = await DialogV2.query(broker, "input", {
        window: {
          title: globalThis.game?.i18n?.localize?.("PF2EActionForge.GMDC.Title") ?? "Action Forge · DC Required"
        },
        content,
        ok: {
          label: globalThis.game?.i18n?.localize?.("PF2EActionForge.GMDC.Approve") ?? "Set DC & Roll"
        },
        rejectClose: false,
        modal: true
      });
    } catch (error) {
      console.error("PF2E Action Forge | GM DC handoff failed", error);
      return { ok: false, reason: "query-error", error, requestId, gmId: broker.id };
    }

    if (!response) return { ok: false, reason: "rejected", requestId, gmId: broker.id };

    const dc = normalizeDc(response.dc);
    if (dc === null) return { ok: false, reason: "invalid-dc", requestId, gmId: broker.id };

    return { ok: true, dc, requestId, gmId: broker.id };
  }
}

export { normalizeDc };
export const gmDcHandoff = new GmDcHandoff();
