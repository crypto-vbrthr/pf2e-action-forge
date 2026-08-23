import { actionRegistry } from "../core/action-registry.js";
import { actorResolver, CURRENT_TOKEN_SELECTION } from "../core/actor-resolver.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ActionForgeApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static #instance = null;

  static DEFAULT_OPTIONS = {
    id: "pf2e-action-forge",
    classes: ["pf2e-action-forge"],
    window: {
      icon: "fa-solid fa-hammer",
      title: "PF2E Action Forge",
      resizable: true
    },
    position: {
      width: 620,
      height: 620
    },
    actions: {
      runAction: ActionForgeApp.#runAction
    }
  };

  static PARTS = {
    main: {
      template: "modules/pf2e-action-forge/templates/action-forge.hbs"
    }
  };

  static get instance() {
    return this.#instance;
  }

  static open() {
    if (!this.#instance) this.#instance = new this();

    // A newly opened window starts in the least surprising mode: follow the
    // currently controlled token. Explicit actor pinning remains active while
    // the already-open window is being used.
    if (!this.#instance.rendered) actorResolver.followCurrentToken();

    this.#instance.render({ force: true });
    return this.#instance;
  }

  static refreshIfOpen() {
    const app = this.#instance;
    if (!app?.rendered) return;
    app.render({ force: true });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const resolution = actorResolver.getContext();
    const actions = actionRegistry.list().map((action) => ({
      ...action,
      labelText: game.i18n.localize(action.label),
      descriptionText: action.description ? game.i18n.localize(action.description) : ""
    }));

    return {
      ...context,
      moduleVersion: game.modules.get("pf2e-action-forge")?.version ?? "0.1.0-dev.1.3",
      actor: resolution.actor
        ? {
            uuid: resolution.actor.uuid,
            name: resolution.actor.name,
            img: resolution.actor.img,
            type: resolution.actor.type,
            source: resolution.source,
            sourceText: game.i18n.localize(`PF2EActionForge.SourceActor.Source.${resolution.source}`)
          }
        : null,
      followsCurrentToken: resolution.selectionMode === "auto",
      currentTokenSelectionValue: CURRENT_TOKEN_SELECTION,
      actors: resolution.actors.map((actor) => ({
        uuid: actor.uuid,
        name: actor.name,
        img: actor.img,
        selected: resolution.selectionMode === "explicit" && resolution.actor?.uuid === actor.uuid
      })),
      actions,
      hasActions: actions.length > 0
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    const actorSelect = this.element.querySelector('[data-role="source-actor"]');
    actorSelect?.addEventListener("change", (event) => {
      actorResolver.setSelectedActor(event.currentTarget.value || CURRENT_TOKEN_SELECTION);
      this.render({ force: true });
    });
  }

  static #runAction(event, target) {
    const actionId = target?.dataset?.actionId;
    const action = actionRegistry.get(actionId);
    const actor = actorResolver.resolve();

    if (!action) {
      ui.notifications.error(game.i18n.localize("PF2EActionForge.Notifications.UnknownAction"));
      return;
    }

    if (!actor) {
      ui.notifications.warn(game.i18n.localize("PF2EActionForge.Notifications.NoActor"));
      return;
    }

    ui.notifications.info(
      game.i18n.format("PF2EActionForge.Notifications.FoundationAction", {
        action: game.i18n.localize(action.label),
        actor: actor.name
      })
    );
  }
}
