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
  getBrokers(users = globalThis.game?.users ?? []) {
    const activeGms = [...users].filter((user) => Boolean(user?.isGM && user?.active));
    const preferred = users?.activeGM ?? globalThis.game?.users?.activeGM ?? null;
    return activeGms.sort((a, b) => {
      if (preferred?.id && a.id === preferred.id) return -1;
      if (preferred?.id && b.id === preferred.id) return 1;
      return String(a.id ?? "").localeCompare(String(b.id ?? ""));
    });
  }

  getBroker(users = globalThis.game?.users ?? []) {
    return this.getBrokers(users)[0] ?? null;
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
    const brokers = this.getBrokers();
    const broker = brokers[0] ?? null;
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

    let lastError = null;
    for (const candidate of brokers) {
      let response;
      try {
        response = await DialogV2.query(candidate, "input", {
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
        lastError = error;
        console.warn(`PF2E Action Forge | GM DC handoff failed via ${candidate?.id ?? "?"}`, error);
        continue;
      }

      // A normal close/rejection is a deliberate GM decision and must not be
      // forwarded to a second GM. Failover is reserved for transport/client loss.
      if (!response) return { ok: false, reason: "rejected", requestId, gmId: candidate.id };

      const dc = normalizeDc(response.dc);
      if (dc === null) return { ok: false, reason: "invalid-dc", requestId, gmId: candidate.id };
      return { ok: true, dc, requestId, gmId: candidate.id };
    }

    return { ok: false, reason: "query-error", error: lastError, requestId, gmId: broker.id };
  }
}

export { normalizeDc };
export const gmDcHandoff = new GmDcHandoff();
