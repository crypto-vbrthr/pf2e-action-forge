const VISIBILITY_MODES = new Set(["public", "player-gm", "gm", "blind", "self", "none"]);

function normalizeMode(value, fallback = "public") {
  return VISIBILITY_MODES.has(value) ? value : fallback;
}

function uniqueUsers(users = []) {
  const seen = new Set();
  const result = [];
  for (const user of users) {
    const id = typeof user === "string" ? user : user?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

export class VisibilityEngine {
  normalize(profile = {}) {
    return Object.freeze({
      announcement: normalizeMode(profile.announcement, "public"),
      roll: normalizeMode(profile.roll, "public"),
      outcome: normalizeMode(profile.outcome, "public")
    });
  }

  getRollTraits(definition, systemAction = null) {
    const rollMode = normalizeMode(definition?.visibility?.roll, "public");
    if (!new Set(["blind", "gm"]).has(rollMode)) return [];

    const traits = Array.isArray(systemAction?.traits) ? systemAction.traits : [];
    return traits.includes("secret") ? [] : ["secret"];
  }

  shouldRevealLocalResult(definition, user = game?.user) {
    if (user?.isGM) return true;
    const profile = definition?.visibility ?? {};
    const rollMode = normalizeMode(profile.roll, "public");
    const outcomeMode = normalizeMode(profile.outcome, "public");
    return !["blind", "gm"].includes(rollMode) && !["blind", "gm"].includes(outcomeMode);
  }

  getRecipients(mode, { user = game?.user, users = game?.users } = {}) {
    const normalized = normalizeMode(mode, "public");
    if (normalized === "public" || normalized === "none") return [];

    const allUsers = users ? Array.from(users) : [];
    const activeGms = allUsers.filter((candidate) => candidate?.isGM && candidate?.active !== false);

    switch (normalized) {
      case "player-gm":
        return uniqueUsers([user, ...activeGms]);
      case "gm":
      case "blind":
        return uniqueUsers(activeGms);
      case "self":
        return uniqueUsers([user]);
      default:
        return [];
    }
  }

  async createAnnouncement({ definition, actor }) {
    const mode = normalizeMode(definition?.visibility?.announcement, "public");
    if (mode === "none" || mode === "public") {
      // Public PF2e roll cards already announce their action. Avoid duplicate chat noise.
      return { created: false, reason: mode === "none" ? "disabled" : "covered-by-roll" };
    }

    if (!globalThis.ChatMessage?.create || !actor) return { created: false, reason: "unavailable" };

    const recipients = this.getRecipients(mode);
    if (recipients.length === 0) return { created: false, reason: "no-recipients" };

    const escape = globalThis.foundry?.utils?.escapeHTML ?? ((value) => String(value));
    const actionName = game.i18n.localize(definition.label);
    const content = `<div class="pf2e-action-forge-announcement"><strong>${escape(actor.name)}</strong>: ${escape(actionName)}</div>`;
    const data = { content, whisper: recipients };
    if (mode === "blind") data.blind = true;

    const message = await ChatMessage.create(data);
    return { created: true, message };
  }
}

export { VISIBILITY_MODES, normalizeMode };
export const visibilityEngine = new VisibilityEngine();
