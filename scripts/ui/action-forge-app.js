import { actionRegistry } from "../core/action-registry.js";
import { actorResolver, CURRENT_TOKEN_SELECTION } from "../core/actor-resolver.js";
import { favoritesService } from "../core/favorites-service.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ActionForgeApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static #instance = null;

  searchQuery = "";

  static DEFAULT_OPTIONS = {
    id: "pf2e-action-forge",
    classes: ["pf2e-action-forge"],
    window: {
      icon: "fa-solid fa-hammer",
      title: "PF2E Action Forge",
      resizable: true
    },
    position: {
      width: 700,
      height: 720
    },
    actions: {
      runAction: ActionForgeApp.#runAction,
      toggleFavorite: ActionForgeApp.#toggleFavorite
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
    if (!this.#instance.rendered) {
      actorResolver.followCurrentToken();
      this.#instance.searchQuery = "";
    }

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
    const favoriteIds = new Set(favoritesService.getIds());
    const actions = actionRegistry.list().map((action) => this.#prepareAction(action, favoriteIds));
    const favoriteActions = actions.filter((action) => action.isFavorite);
    const categories = this.#groupByCategory(actions);

    return {
      ...context,
      moduleVersion: game.modules.get("pf2e-action-forge")?.version ?? "0.1.0-dev.2",
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
      categories,
      favoriteActions,
      hasFavorites: favoriteActions.length > 0,
      hasActions: actions.length > 0,
      searchQuery: this.searchQuery
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    const actorSelect = this.element.querySelector('[data-role="source-actor"]');
    actorSelect?.addEventListener("change", (event) => {
      actorResolver.setSelectedActor(event.currentTarget.value || CURRENT_TOKEN_SELECTION);
      this.render({ force: true });
    });

    const search = this.element.querySelector('[data-role="action-search"]');
    search?.addEventListener("input", (event) => {
      this.searchQuery = event.currentTarget.value ?? "";
      this.#applySearchFilter();
    });

    this.#applySearchFilter();
  }

  #prepareAction(action, favoriteIds) {
    const labelText = game.i18n.localize(action.label);
    const descriptionText = action.description ? game.i18n.localize(action.description) : "";
    const categoryText = game.i18n.localize(action.categoryLabel);
    const searchText = [labelText, descriptionText, categoryText, ...action.keywords]
      .join(" ")
      .toLocaleLowerCase(game.i18n.lang);

    return {
      ...action,
      labelText,
      descriptionText,
      categoryText,
      searchText,
      isFavorite: favoriteIds.has(action.id),
      favoriteLabel: game.i18n.localize(
        favoriteIds.has(action.id)
          ? "PF2EActionForge.Favorites.Remove"
          : "PF2EActionForge.Favorites.Add"
      )
    };
  }

  #groupByCategory(actions) {
    const groups = new Map();
    for (const action of actions) {
      if (!groups.has(action.category)) {
        groups.set(action.category, {
          id: action.category,
          label: action.categoryText,
          icon: action.categoryIcon,
          order: action.categoryOrder,
          actions: []
        });
      }
      groups.get(action.category).actions.push(action);
    }
    return [...groups.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, game.i18n.lang));
  }

  #applySearchFilter() {
    if (!this.element) return;
    const query = this.searchQuery.trim().toLocaleLowerCase(game.i18n.lang);
    let anyVisible = false;

    for (const card of this.element.querySelectorAll("[data-action-card]")) {
      const matches = !query || card.dataset.searchText?.includes(query);
      card.hidden = !matches;
      if (matches) anyVisible = true;
    }

    for (const group of this.element.querySelectorAll("[data-action-group]")) {
      const visibleCard = [...group.querySelectorAll("[data-action-card]")].some((card) => !card.hidden);
      group.hidden = !visibleCard;
    }

    const emptySearch = this.element.querySelector('[data-role="search-empty"]');
    if (emptySearch) emptySearch.hidden = anyVisible || !query;
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
      game.i18n.format("PF2EActionForge.Notifications.CatalogAction", {
        action: game.i18n.localize(action.label),
        actor: actor.name
      })
    );
  }

  static async #toggleFavorite(event, target) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const actionId = target?.dataset?.actionId;
    const action = actionRegistry.get(actionId);
    if (!action) {
      ui.notifications.error(game.i18n.localize("PF2EActionForge.Notifications.UnknownAction"));
      return;
    }

    try {
      const result = await favoritesService.toggle(actionId);
      ui.notifications.info(
        game.i18n.format(
          result.added
            ? "PF2EActionForge.Notifications.FavoriteAdded"
            : "PF2EActionForge.Notifications.FavoriteRemoved",
          { action: game.i18n.localize(action.label) }
        )
      );
      ActionForgeApp.instance?.render({ force: true });
    } catch (error) {
      console.error("PF2E Action Forge | Failed to persist favorite", error);
      ui.notifications.error(game.i18n.localize("PF2EActionForge.Notifications.FavoriteError"));
    }
  }
}
