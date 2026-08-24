import { MODULE_ID } from "./action-transaction.js";

const MAX_ENTRIES = 300;

function safeValue(value, depth = 0) {
  if (depth > 3) return "[depth-limit]";
  if (value === null || value === undefined) return value;
  if (["string", "number", "boolean"].includes(typeof value)) return value;
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  if (Array.isArray(value)) return value.slice(0, 25).map((entry) => safeValue(entry, depth + 1));
  if (typeof value === "object") {
    const output = {};
    for (const [key, entry] of Object.entries(value).slice(0, 40)) {
      if (/password|token|secret/i.test(key)) {
        output[key] = "[redacted]";
        continue;
      }
      output[key] = safeValue(entry, depth + 1);
    }
    return output;
  }
  return String(value);
}

function userSnapshot() {
  const user = globalThis.game?.user;
  return {
    id: user?.id ?? null,
    name: user?.name ?? null,
    isGM: Boolean(user?.isGM),
    active: Boolean(user?.active)
  };
}

export class GmDcDebugLog {
  #entries = [];

  add(event, data = {}) {
    const entry = {
      at: new Date().toISOString(),
      event,
      user: userSnapshot(),
      data: safeValue(data)
    };
    this.#entries.push(entry);
    if (this.#entries.length > MAX_ENTRIES) this.#entries.splice(0, this.#entries.length - MAX_ENTRIES);

    // Keep the client-local ring buffer available in RC builds without filling
    // the normal console during successful play. The trace is still visible when
    // verbose/debug messages are enabled and through module.api.debug.
    console.debug(`[PF2E Action Forge][GM-DC] ${event}`, entry);
    return entry;
  }

  clear() {
    this.#entries.length = 0;
    this.add("debug.clear");
  }

  entries() {
    return this.#entries.map((entry) => structuredClone(entry));
  }

  snapshot() {
    const module = globalThis.game?.modules?.get?.(MODULE_ID);
    const users = (() => {
      const source = globalThis.game?.users;
      try {
        const values = Array.isArray(source) ? source : Array.isArray(source?.contents) ? source.contents : [...(source?.values?.() ?? source ?? [])];
        return values.map((user) => ({ id: user?.id ?? null, name: user?.name ?? null, isGM: Boolean(user?.isGM), active: Boolean(user?.active) }));
      } catch (_error) {
        return [];
      }
    })();
    const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    return {
      generatedAt: new Date().toISOString(),
      foundryVersion: globalThis.game?.version ?? globalThis.game?.release?.version ?? null,
      system: {
        id: globalThis.game?.system?.id ?? null,
        version: globalThis.game?.system?.version ?? null
      },
      moduleVersion: module?.version ?? null,
      currentUser: userSnapshot(),
      users,
      capabilities: {
        socket: Boolean(globalThis.game?.socket),
        chatMessageCreate: typeof globalThis.ChatMessage?.create === "function",
        dialogInput: typeof DialogV2?.input === "function",
        dialogWait: typeof DialogV2?.wait === "function",
        userQuery: users.some((user) => {
          const actual = globalThis.game?.users?.get?.(user.id);
          return typeof actual?.query === "function";
        })
      },
      entries: this.entries()
    };
  }

  text() {
    return JSON.stringify(this.snapshot(), null, 2);
  }

  async copy() {
    const text = this.text();
    if (globalThis.navigator?.clipboard?.writeText) {
      await globalThis.navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  }

  async show() {
    const text = this.text();
    const escape = globalThis.foundry?.utils?.escapeHTML;
    const safeText = typeof escape === "function" ? escape(text) : text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
    const content = `<div class="pf2e-action-forge-debug-report"><p>Client-local GM-DC diagnostic trace. Copy this from both the player and GM client after reproducing the failure.</p><textarea readonly style="width:100%;height:420px;font-family:monospace;white-space:pre;">${safeText}</textarea></div>`;
    const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    if (typeof DialogV2?.input === "function") {
      await DialogV2.input({
        window: { title: "PF2E Action Forge · GM-DC Debug" },
        content,
        ok: { label: "Close" },
        modal: false,
        rejectClose: false
      });
      return text;
    }
    console.info("[PF2E Action Forge][GM-DC] Debug report", text);
    return text;
  }
}

export const gmDcDebugLog = new GmDcDebugLog();
