import { actionRegistry } from "../core/action-registry.js";
import { actorResolver, CURRENT_TOKEN_SELECTION } from "../core/actor-resolver.js";
import { dcResolver } from "../core/dc-resolver.js";
import { favoritesService } from "../core/favorites-service.js";
import { pf2eActionAdapter } from "../core/pf2e-action-adapter.js";
import { targetResolver } from "../core/target-resolver.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ActionForgeApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static #instance = null;

  searchQuery = "";
  activeActionId = null;
  manualDcByAction = new Map();
  lastRoll = null;

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
      height: 790
    },
    actions: {
      runAction: ActionForgeApp.#runAction,
      executeAction: ActionForgeApp.#executeAction,
      toggleFavorite: ActionForgeApp.#toggleFavorite,
      removeTarget: ActionForgeApp.#removeTarget,
      useCanvasTargets: ActionForgeApp.#useCanvasTargets,
      closeActionSelection: ActionForgeApp.#closeActionSelection
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

    if (!this.#instance.rendered) {
      actorResolver.followCurrentToken();
      targetResolver.clear();
      this.#instance.searchQuery = "";
      this.#instance.activeActionId = null;
      this.#instance.manualDcByAction.clear();
      this.#instance.lastRoll = null;
    }

    this.#instance.render({ force: true });
    return this.#instance;
  }

  static refreshIfOpen() {
    const app = this.#instance;
    if (!app?.rendered) return;
    app.render({ force: true });
  }

  static refreshTargetsIfOpen({ preferCanvas = false } = {}) {
    const app = this.#instance;
    if (!app?.rendered || !app.activeActionId) return;
    const action = actionRegistry.get(app.activeActionId);
    if (action && preferCanvas) targetResolver.preferCanvas(action);
    app.render({ force: true });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const resolution = actorResolver.getContext();
    const favoriteIds = new Set(favoritesService.getIds());
    const actions = actionRegistry.list().map((action) => this.#prepareAction(action, favoriteIds));
    const favoriteActions = actions.filter((action) => action.isFavorite);
    const categories = this.#groupByCategory(actions);

    const activeDefinition = this.activeActionId ? actionRegistry.get(this.activeActionId) : null;
    const activeAction = activeDefinition ? this.#prepareAction(activeDefinition, favoriteIds) : null;
    let targetContext = null;
    let dcContext = null;
    let executionContext = null;

    if (activeDefinition) {
      targetResolver.activate(activeDefinition);
      const targetState = targetResolver.getState(activeDefinition);
      const manualDc = this.manualDcByAction.get(activeDefinition.id) ?? null;
      const dcState = dcResolver.getState(activeDefinition, targetState, { manualDc });

      const targetHintKey =
        targetState.mode === "single" && !targetState.required
          ? "PF2EActionForge.Target.Hint.singleOptional"
          : `PF2EActionForge.Target.Hint.${targetState.mode}`;

      targetContext = {
        ...targetState,
        modeLabel: game.i18n.localize(`PF2EActionForge.Target.Mode.${targetState.mode}`),
        hint: game.i18n.localize(targetHintKey),
        targets: targetState.targets.map((entry) => ({
          key: entry.key,
          name: entry.name,
          img: entry.img,
          actorUuid: entry.actorUuid,
          tokenUuid: entry.tokenUuid,
          source: entry.source,
          sourceText: game.i18n.localize(`PF2EActionForge.Target.Source.${entry.source}`)
        }))
      };

      dcContext = this.#prepareDcContext(activeDefinition, dcState);
      const systemActionAvailable = activeDefinition.execution.enabled
        ? pf2eActionAdapter.isAvailable(activeDefinition)
        : false;
      const canExecute = Boolean(
        resolution.actor &&
        activeDefinition.execution.enabled &&
        systemActionAvailable &&
        targetState.valid &&
        dcState.valid
      );

      executionContext = {
        enabled: activeDefinition.execution.enabled,
        systemActionAvailable,
        canExecute,
        unavailableText: !activeDefinition.execution.enabled
          ? game.i18n.localize("PF2EActionForge.Roll.LaterBlock")
          : !systemActionAvailable
            ? game.i18n.localize("PF2EActionForge.Roll.SystemActionMissing")
            : ""
      };
    }

    return {
      ...context,
      moduleVersion: game.modules.get("pf2e-action-forge")?.version ?? "0.1.0-dev.4",
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
      searchQuery: this.searchQuery,
      activeAction,
      targetContext,
      dcContext,
      executionContext,
      lastRoll:
        this.lastRoll && this.lastRoll.actionId === activeDefinition?.id
          ? this.lastRoll
          : null
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    const actorSelect = this.element.querySelector('[data-role="source-actor"]');
    actorSelect?.addEventListener("change", (event) => {
      actorResolver.setSelectedActor(event.currentTarget.value || CURRENT_TOKEN_SELECTION);
      this.lastRoll = null;
      this.render({ force: true });
    });

    const search = this.element.querySelector('[data-role="action-search"]');
    search?.addEventListener("input", (event) => {
      this.searchQuery = event.currentTarget.value ?? "";
      this.#applySearchFilter();
    });

    const manualDcInput = this.element.querySelector('[data-role="manual-dc"]');
    manualDcInput?.addEventListener("input", (event) => {
      if (!this.activeActionId) return;
      this.manualDcByAction.set(this.activeActionId, event.currentTarget.value ?? "");
      this.#updateExecutionControls();
    });

    const dropZone = this.element.querySelector('[data-role="target-drop-zone"]');
    if (dropZone) {
      dropZone.addEventListener("dragenter", (event) => {
        event.preventDefault();
        dropZone.classList.add("is-dragover");
      });
      dropZone.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
        dropZone.classList.add("is-dragover");
      });
      dropZone.addEventListener("dragleave", (event) => {
        if (event.relatedTarget && dropZone.contains(event.relatedTarget)) return;
        dropZone.classList.remove("is-dragover");
      });
      dropZone.addEventListener("drop", async (event) => {
        event.preventDefault();
        dropZone.classList.remove("is-dragover");
        await this.#handleTargetDrop(event);
      });
    }

    this.#applySearchFilter();
    this.#updateExecutionControls();
  }

  #prepareAction(action, favoriteIds) {
    const labelText = game.i18n.localize(action.label);
    const descriptionText = action.description ? game.i18n.localize(action.description) : "";
    const categoryText = game.i18n.localize(action.categoryLabel);
    const targetModeText = game.i18n.localize(`PF2EActionForge.Target.Mode.${action.target.mode}`);
    const searchText = [labelText, descriptionText, categoryText, targetModeText, ...action.keywords]
      .join(" ")
      .toLocaleLowerCase(game.i18n.lang);

    return {
      ...action,
      labelText,
      descriptionText,
      categoryText,
      targetModeText,
      searchText,
      isFavorite: favoriteIds.has(action.id),
      isActive: this.activeActionId === action.id,
      rollReady: action.execution.enabled,
      favoriteLabel: game.i18n.localize(
        favoriteIds.has(action.id)
          ? "PF2EActionForge.Favorites.Remove"
          : "PF2EActionForge.Favorites.Add"
      )
    };
  }

  #prepareDcContext(action, state) {
    const sourceText = (() => {
      if (state.source === "target") {
        return game.i18n.format("PF2EActionForge.DC.TargetDefense", {
          defense: game.i18n.localize(state.labelKey),
          target: state.target?.name ?? ""
        });
      }
      if (state.source === "manual" && state.manualDc !== null) {
        return game.i18n.format("PF2EActionForge.DC.ManualValue", { dc: state.manualDc });
      }
      if (state.source === "fixed") {
        return game.i18n.format("PF2EActionForge.DC.FixedValue", { dc: state.difficultyClass ?? "" });
      }
      return game.i18n.localize(state.labelKey);
    })();

    return {
      ...state,
      sourceText,
      statusText: game.i18n.localize(
        state.valid ? "PF2EActionForge.DC.Ready" : "PF2EActionForge.DC.Required"
      ),
      showManualInput:
        state.strategy === "manual" ||
        state.strategy === "gm-defined" ||
        (state.strategy === "target-defense" && !state.target && state.allowsManualDc),
      manualInputValue: this.manualDcByAction.get(action.id) ?? "",
      manualInputLabel: game.i18n.localize("PF2EActionForge.DC.ManualInput"),
      manualInputHint: game.i18n.localize("PF2EActionForge.DC.ManualInputHint")
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

  #updateExecutionControls() {
    if (!this.element || !this.activeActionId) return;
    const action = actionRegistry.get(this.activeActionId);
    if (!action) return;

    const targetState = targetResolver.getState(action);
    const manualDc = this.manualDcByAction.get(action.id) ?? null;
    const dcState = dcResolver.getState(action, targetState, { manualDc });
    const actor = actorResolver.resolve();
    const systemActionAvailable = action.execution.enabled ? pf2eActionAdapter.isAvailable(action) : false;
    const canExecute = Boolean(actor && action.execution.enabled && systemActionAvailable && targetState.valid && dcState.valid);

    const button = this.element.querySelector('[data-action="executeAction"]');
    if (button) button.disabled = !canExecute;

    const status = this.element.querySelector('[data-role="dc-status"]');
    if (status) {
      status.classList.toggle("is-valid", dcState.valid);
      status.classList.toggle("is-required", !dcState.valid);
      const icon = status.querySelector("i");
      icon?.classList.toggle("fa-check", dcState.valid);
      icon?.classList.toggle("fa-circle-exclamation", !dcState.valid);
      const text = status.querySelector("span");
      if (text) {
        text.textContent = game.i18n.localize(
          dcState.valid ? "PF2EActionForge.DC.Ready" : "PF2EActionForge.DC.Required"
        );
      }
    }
  }

  async #handleTargetDrop(event) {
    const action = this.activeActionId ? actionRegistry.get(this.activeActionId) : null;
    if (!action) return;

    const result = await targetResolver.addFromDropEvent(event, action);
    if (!result.ok) {
      const key = {
        "not-allowed": "PF2EActionForge.Notifications.TargetNotAllowed",
        "invalid-data": "PF2EActionForge.Notifications.TargetDropInvalid",
        "invalid-actor": "PF2EActionForge.Notifications.TargetDropInvalidActor",
        "not-visible": "PF2EActionForge.Notifications.TargetNotVisible"
      }[result.reason] ?? "PF2EActionForge.Notifications.TargetDropInvalid";
      ui.notifications.warn(game.i18n.localize(key));
      return;
    }

    this.lastRoll = null;
    this.render({ force: true });
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

    const app = ActionForgeApp.instance;
    if (!app) return;
    app.activeActionId = action.id;
    app.lastRoll = null;
    targetResolver.activate(action);
    app.render({ force: true });
  }

  static async #executeAction(event) {
    event?.preventDefault?.();
    const app = ActionForgeApp.instance;
    const action = app?.activeActionId ? actionRegistry.get(app.activeActionId) : null;
    const actor = actorResolver.resolve();

    if (!action) {
      ui.notifications.error(game.i18n.localize("PF2EActionForge.Notifications.UnknownAction"));
      return;
    }
    if (!actor) {
      ui.notifications.warn(game.i18n.localize("PF2EActionForge.Notifications.NoActor"));
      return;
    }
    if (!action.execution.enabled) {
      ui.notifications.info(game.i18n.localize("PF2EActionForge.Roll.LaterBlock"));
      return;
    }

    const targetState = targetResolver.getState(action);
    if (!targetState.valid) {
      ui.notifications.warn(game.i18n.localize("PF2EActionForge.Notifications.TargetRequired"));
      return;
    }

    const manualDc = app.manualDcByAction.get(action.id) ?? null;
    const dcResolution = dcResolver.resolve(action, targetState, { manualDc });
    if (!dcResolution.ok) {
      ui.notifications.warn(game.i18n.localize("PF2EActionForge.Notifications.DCRequired"));
      return;
    }

    const execution = await pf2eActionAdapter.execute({
      definition: action,
      actor,
      target: dcResolution.target,
      difficultyClass: dcResolution.difficultyClass,
      event
    });

    if (!execution.ok) {
      const key = {
        "missing-system-action": "PF2EActionForge.Notifications.SystemActionMissing",
        "execution-error": "PF2EActionForge.Notifications.RollFailed",
        "not-enabled": "PF2EActionForge.Roll.LaterBlock"
      }[execution.reason] ?? "PF2EActionForge.Notifications.RollFailed";
      ui.notifications.error(game.i18n.localize(key));
      return;
    }

    const result = execution.results.at(-1) ?? null;
    if (result) {
      const outcome = result.outcome ?? "unknown";
      app.lastRoll = {
        actionId: action.id,
        total: Number.isFinite(result.roll?.total) ? result.roll.total : "–",
        outcome,
        outcomeText: game.i18n.localize(`PF2EActionForge.Roll.Outcome.${outcome}`),
        actorName: actor.name
      };
      app.render({ force: true });
    }
  }

  static async #removeTarget(event, target) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const key = target?.dataset?.targetKey;
    if (!key) return;
    await targetResolver.remove(key);
    const app = ActionForgeApp.instance;
    if (app) app.lastRoll = null;
    app?.render({ force: true });
  }

  static #useCanvasTargets(event) {
    event?.preventDefault?.();
    const app = ActionForgeApp.instance;
    const action = app?.activeActionId ? actionRegistry.get(app.activeActionId) : null;
    if (!action) return;
    targetResolver.preferCanvas(action);
    app.lastRoll = null;
    app.render({ force: true });
  }

  static #closeActionSelection(event) {
    event?.preventDefault?.();
    const app = ActionForgeApp.instance;
    if (!app) return;
    app.activeActionId = null;
    app.lastRoll = null;
    targetResolver.clear();
    app.render({ force: true });
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
