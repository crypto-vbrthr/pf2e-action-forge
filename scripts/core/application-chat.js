import { actionRegistry } from "./action-registry.js";
import { applicationBroker } from "./application-broker.js";
import { applicationEngine } from "./application-engine.js";
import { MODULE_ID } from "./action-transaction.js";
import { canUserActWith } from "./actor-resolver.js";

function escapeHtml(value) {
  const escape = globalThis.foundry?.utils?.escapeHTML;
  return typeof escape === "function" ? escape(String(value ?? "")) : String(value ?? "");
}

function labelForEffect(effect) {
  if (effect.label) return globalThis.game?.i18n?.localize?.(effect.label) ?? effect.label;
  if (effect.type === "condition-add") {
    const conditionName = globalThis.game?.pf2e?.ConditionManager?.getCondition?.(effect.condition)?.name ?? effect.condition;
    return globalThis.game?.i18n?.format?.("PF2EActionForge.Application.ApplyCondition", { condition: conditionName }) ?? `Apply ${conditionName}`;
  }
  if (effect.type === "condition-remove") return globalThis.game?.i18n?.localize?.("PF2EActionForge.Application.RemoveCondition") ?? effect.id;
  if (effect.type === "heal") return globalThis.game?.i18n?.localize?.("PF2EActionForge.Application.ApplyHealing") ?? effect.id;
  if (effect.type === "damage") return globalThis.game?.i18n?.localize?.("PF2EActionForge.Application.ApplyDamage") ?? effect.id;
  if (effect.type === "immunity") return globalThis.game?.i18n?.localize?.("PF2EActionForge.Application.ApplyImmunity") ?? effect.id;
  return effect.id;
}

function appliedLabel(application) {
  const base = globalThis.game?.i18n?.localize?.("PF2EActionForge.Application.Applied") ?? "Applied";
  const actual = Number(application?.appliedValue);
  const rolled = Number(application?.value);
  const value = Number.isFinite(actual) ? actual : rolled;
  return Number.isFinite(value) && value > 0 ? `${base} (${value})` : base;
}

export class ApplicationChat {
  async create({ definition, transaction } = {}) {
    const effects = applicationEngine.getEffects(definition, transaction?.outcome);
    if (!transaction?.targetActorUuid || effects.length === 0 || !globalThis.ChatMessage?.create) return null;

    const actionName = globalThis.game?.i18n?.localize?.(definition.label) ?? definition.id;
    const outcomeText = globalThis.game?.i18n?.localize?.(`PF2EActionForge.Roll.Outcome.${transaction.outcome}`) ?? transaction.outcome;
    const buttons = effects.map((effect) => `
      <button type="button" class="af-application-button" data-effect-id="${escapeHtml(effect.id)}">
        <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
        ${escapeHtml(labelForEffect(effect))}
      </button>`).join("");
    const noteKey = definition?.application?.outcomeNotes?.[transaction.outcome] ?? null;
    const note = noteKey ? globalThis.game?.i18n?.localize?.(noteKey) ?? noteKey : "";

    const content = `
      <div class="pf2e-action-forge-application-card">
        <header><strong>${escapeHtml(actionName)}</strong><span>${escapeHtml(outcomeText)}</span></header>
        <p>${escapeHtml(globalThis.game?.i18n?.format?.("PF2EActionForge.Application.Target", { target: transaction.targetActorName }) ?? transaction.targetActorName)}</p>
        ${note ? `<p class="af-application-note"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> ${escapeHtml(note)}</p>` : ""}
        <div class="af-application-actions">${buttons}</div>
      </div>`;

    const speaker = globalThis.ChatMessage.getSpeaker?.({ alias: transaction.sourceActorName }) ?? { alias: transaction.sourceActorName };
    const message = await ChatMessage.create({
      speaker,
      content,
      flags: {
        [MODULE_ID]: {
          application: {
            transaction,
            applied: {}
          }
        }
      }
    });

    // Some consequences are intrinsic to the completed action rather than an
    // optional follow-up. Treat Wounds immunity is the first such case. Keep
    // the button in the card as a safe fallback if the broker cannot complete
    // the automatic write (for example while a GM disconnects mid-action).
    for (const effect of effects.filter((entry) => entry.mode === "auto")) {
      void this.#autoApply(message, transaction, effect);
    }

    return message;
  }

  decorate(message, html) {
    const flag = message?.flags?.[MODULE_ID]?.application;
    if (!flag) return;
    const root = globalThis.HTMLElement && html instanceof HTMLElement ? html : html?.[0] ?? null;
    if (!root) return;

    const applied = flag.applied ?? {};
    for (const button of root.querySelectorAll(".af-application-button")) {
      const effectId = button.dataset.effectId;
      if (applied[effectId]) {
        button.disabled = true;
        button.classList.add("is-applied");
        button.innerHTML = `<i class="fa-solid fa-check" aria-hidden="true"></i> ${escapeHtml(appliedLabel(applied[effectId]))}`;
      }

      // Foundry v14 can render chat messages in containers where relying only
      // on one document-level delegated click handler is brittle. Bind each
      // rendered application control directly to its ChatMessage as the
      // authoritative path, while keeping the delegated handler as fallback.
      if (button.dataset.afApplicationBound !== "true") {
        button.dataset.afApplicationBound = "true";
        button.addEventListener("click", (event) => this.#handleButtonClick(event, button, message));
      }
    }

    this.#setPermissionState(flag, root);
  }

  bindGlobalClickHandler() {
    if (!globalThis.document?.addEventListener) return;
    document.addEventListener("click", (event) => {
      const button = event.target?.closest?.(".af-application-button");
      if (!button || button.dataset.afApplicationBound === "true") return;
      const messageElement = button.closest?.(".chat-message");
      const messageId = messageElement?.dataset?.messageId ?? messageElement?.dataset?.messageid;
      const message = globalThis.game?.messages?.get?.(messageId);
      if (!message) return;
      void this.#handleButtonClick(event, button, message);
    });
  }

  async #handleButtonClick(event, button, message) {
    const flag = message?.flags?.[MODULE_ID]?.application;
    if (!message || !flag || button.disabled) return;

    event?.preventDefault?.();
    event?.stopPropagation?.();
    button.disabled = true;
    button.classList.add("is-pending");

    const result = await this.#requestWithReplicationRetry({
      messageId: message.id,
      transactionId: flag.transaction.id,
      effectId: button.dataset.effectId
    });

    button.classList.remove("is-pending");
    if (result.ok) {
      button.classList.add("is-applied");
      button.innerHTML = `<i class="fa-solid fa-check" aria-hidden="true"></i> ${escapeHtml(appliedLabel(result.application))}`;
      globalThis.ui?.notifications?.info?.(globalThis.game?.i18n?.localize?.("PF2EActionForge.Application.Success") ?? "Action result applied.");
    } else {
      button.disabled = false;
      const key = {
        "no-active-gm": "PF2EActionForge.Application.NoActiveGM",
        "source-not-owned": "PF2EActionForge.Application.NotAllowed",
        "invalid-target": "PF2EActionForge.Application.InvalidTarget",
        immune: "PF2EActionForge.Application.Immune",
        "invalid-formula": "PF2EActionForge.Application.InvalidFormula",
        "missing-hit-points": "PF2EActionForge.Application.MissingHitPoints",
        "missing-transaction": "PF2EActionForge.Application.TransactionNotReady",
        "transaction-mismatch": "PF2EActionForge.Application.TransactionNotReady",
        timeout: "PF2EActionForge.Application.Timeout",
        "broker-error": "PF2EActionForge.Application.BrokerError",
        "query-failed": "PF2EActionForge.Application.BrokerError"
      }[result.reason] ?? "PF2EActionForge.Application.Failed";
      globalThis.ui?.notifications?.warn?.(globalThis.game?.i18n?.localize?.(key) ?? result.reason);
    }
  }

  async #requestWithReplicationRetry(payload) {
    const delays = [0, 150, 400, 800];
    let result = { ok: false, reason: "missing-transaction" };
    for (const delay of delays) {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      result = await applicationBroker.request(payload);
      if (result.ok || !["missing-transaction", "transaction-mismatch"].includes(result.reason)) return result;
    }
    return result;
  }

  async #autoApply(message, transaction, effect) {
    if (!message?.id || !transaction?.id || !effect?.id) return;

    const delays = [0, 150, 400];
    for (const delay of delays) {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      const result = await applicationBroker.request({
        messageId: message.id,
        transactionId: transaction.id,
        effectId: effect.id
      });
      if (result.ok) return;
      // A freshly-created ChatMessage can reach the broker a fraction later
      // than the socket request. Retry only replication-shaped failures; other
      // failures intentionally leave the visible button available as fallback.
      if (!["missing-transaction", "transaction-mismatch"].includes(result.reason)) return;
    }
  }

  async #setPermissionState(flag, root) {
    if (globalThis.game?.user?.isGM) return;
    const sourceUuid = flag.transaction?.sourceActorUuid;
    if (!sourceUuid || typeof globalThis.fromUuid !== "function") return;
    try {
      const doc = await fromUuid(sourceUuid);
      const actor = doc?.actor ?? doc;
      if (!canUserActWith(actor, globalThis.game?.user)) {
        for (const button of root.querySelectorAll(".af-application-button")) button.hidden = true;
      }
    } catch (_error) {
      for (const button of root.querySelectorAll(".af-application-button")) button.hidden = true;
    }
  }
}

export const applicationChat = new ApplicationChat();
