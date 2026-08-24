import { actionRegistry } from "../core/action-registry.js";
import { applicationChat } from "../core/application-chat.js";
import { applicationEngine } from "../core/application-engine.js";
import { ActionTransaction } from "../core/action-transaction.js";
import { actorResolver, CURRENT_TOKEN_SELECTION } from "../core/actor-resolver.js";
import { dcResolver, statisticRank } from "../core/dc-resolver.js";
import { favoritesService } from "../core/favorites-service.js";
import { explorationActivityService } from "../core/exploration-activity-service.js";
import { gmDcHandoff } from "../core/gm-dc-handoff.js";
import { pf2eActionAdapter } from "../core/pf2e-action-adapter.js";
import { targetResolver } from "../core/target-resolver.js";
import { targetPickerService } from "../core/target-picker-service.js";
import { visibilityEngine } from "../core/visibility-engine.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ActionForgeApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static #instance = null;

  searchQuery = "";
  activeActionId = null;
  manualDcByAction = new Map();
  statisticByAction = new Map();
  lastRoll = null;
  pendingGmDcRequest = null;
  executionInFlight = false;
  _restoreUiState = null;
  _scrollToExecutionAfterRender = false;

  static DEFAULT_OPTIONS = {
    id: "pf2e-action-forge",
    classes: ["pf2e-action-forge"],
    window: {
      icon: "fa-solid fa-hammer",
      title: "PF2E Action Forge",
      resizable: true
    },
    position: {
      width: 1120,
      height: 820
    },
    actions: {
      runAction: ActionForgeApp.#runAction,
      executeAction: ActionForgeApp.#executeAction,
      toggleFavorite: ActionForgeApp.#toggleFavorite,
      removeTarget: ActionForgeApp.#removeTarget,
      useCanvasTargets: ActionForgeApp.#useCanvasTargets,
      pickTarget: ActionForgeApp.#pickTarget,
      closeActionSelection: ActionForgeApp.#closeActionSelection,
      clearExplorationActivity: ActionForgeApp.#clearExplorationActivity
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
      actorResolver.unlockActionActor();
      actorResolver.followCurrentToken();
      targetResolver.clear();
      this.#instance.searchQuery = "";
      this.#instance.activeActionId = null;
      this.#instance.manualDcByAction.clear();
      this.#instance.statisticByAction.clear();
      this.#instance.lastRoll = null;
      this.#instance.pendingGmDcRequest = null;
      this.#instance.executionInFlight = false;
      this.#instance._restoreUiState = null;
      this.#instance._scrollToExecutionAfterRender = false;
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
    if (!app?.rendered || !app.activeActionId || app.pendingGmDcRequest || app.executionInFlight) return;
    const action = actionRegistry.get(app.activeActionId);
    if (action && preferCanvas) targetResolver.preferCanvas(action);
    app.render({ force: true });
  }


  render(options = {}) {
    if (this.rendered && !this._restoreUiState) this._restoreUiState = this.#captureUiState();
    return super.render(options);
  }

  #captureUiState() {
    const shell = this.element?.querySelector?.(".af-shell") ?? null;
    const active = globalThis.document?.activeElement ?? null;
    let focus = null;
    if (active && this.element?.contains?.(active)) {
      if (active.dataset?.role) {
        focus = { kind: "role", value: active.dataset.role };
      } else if (active.dataset?.action) {
        focus = {
          kind: "action",
          value: active.dataset.action,
          actionId: active.dataset.actionId ?? null,
          targetKey: active.dataset.targetKey ?? null
        };
      } else if (active.id) {
        focus = { kind: "id", value: active.id };
      }
      if (focus && Number.isInteger(active.selectionStart) && Number.isInteger(active.selectionEnd)) {
        focus.selectionStart = active.selectionStart;
        focus.selectionEnd = active.selectionEnd;
      }
    }
    return { scrollTop: Number(shell?.scrollTop ?? 0), focus };
  }

  #restoreUiStateAfterRender() {
    const state = this._restoreUiState;
    this._restoreUiState = null;
    if (!state || !this.element) return;

    const shell = this.element.querySelector?.(".af-shell");
    if (shell && Number.isFinite(state.scrollTop)) shell.scrollTop = state.scrollTop;

    const descriptor = state.focus;
    if (!descriptor) return;
    const escape = globalThis.CSS?.escape ?? ((value) => String(value).replaceAll('"', '\"'));
    let selector = null;
    if (descriptor.kind === "role") selector = `[data-role="${escape(descriptor.value)}"]`;
    else if (descriptor.kind === "id") selector = `#${escape(descriptor.value)}`;
    else if (descriptor.kind === "action") {
      selector = `[data-action="${escape(descriptor.value)}"]`;
      if (descriptor.actionId) selector += `[data-action-id="${escape(descriptor.actionId)}"]`;
      if (descriptor.targetKey) selector += `[data-target-key="${escape(descriptor.targetKey)}"]`;
    }

    const element = selector ? this.element.querySelector?.(selector) : null;
    if (!element || element.disabled || element.hidden) return;
    try { element.focus?.({ preventScroll: true }); } catch (_error) { element.focus?.(); }
    if (typeof element.setSelectionRange === "function" && Number.isInteger(descriptor.selectionStart)) {
      try { element.setSelectionRange(descriptor.selectionStart, descriptor.selectionEnd); } catch (_error) { /* non-text control */ }
    }
  }

  #scrollToExecutionAfterRender() {
    const shouldScroll = this._scrollToExecutionAfterRender;
    this._scrollToExecutionAfterRender = false;
    if (!shouldScroll || !this.element) return;

    const shell = this.element.querySelector?.(".af-shell");
    const workflow = this.element.querySelector?.('[data-role="execution-workflow"]');
    if (!shell || !workflow) return;

    const shellRect = shell.getBoundingClientRect?.();
    const workflowRect = workflow.getBoundingClientRect?.();
    if (!shellRect || !workflowRect) return;

    const top = Math.max(0, shell.scrollTop + workflowRect.top - shellRect.top - 8);
    const reduceMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    if (typeof shell.scrollTo === "function") {
      shell.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
    } else {
      shell.scrollTop = top;
    }
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const resolution = actorResolver.getContext();
    const favoriteIds = new Set(favoritesService.getIds());
    const actions = actionRegistry.list().map((action) => this.#prepareAction(action, favoriteIds));
    const favoriteActions = actions.filter((action) => action.isFavorite);
    const categories = this.#groupByCategory(actions);
    const storedExploration = explorationActivityService.get(resolution.actor);
    const storedExplorationDefinition = storedExploration ? actionRegistry.get(storedExploration.actionId) : null;
    const activeExploration = storedExploration && storedExplorationDefinition?.execution?.mode === "exploration-activity"
      ? {
          actionId: storedExploration.actionId,
          label: game.i18n.localize(storedExplorationDefinition.label),
          description: storedExplorationDefinition.description ? game.i18n.localize(storedExplorationDefinition.description) : "",
          icon: storedExplorationDefinition.icon,
          statistic: storedExploration.statistic,
          statisticLabel: storedExploration.statistic
            ? this.#getStatisticOptions(storedExplorationDefinition, resolution.actor)
                .find((entry) => entry.slug === storedExploration.statistic)?.label ?? storedExploration.statistic
            : null,
          targetName: storedExploration.targetActorName ?? null
        }
      : null;

    const activeDefinition = this.activeActionId ? actionRegistry.get(this.activeActionId) : null;
    const activeAction = activeDefinition ? this.#prepareAction(activeDefinition, favoriteIds) : null;
    let targetContext = null;
    let dcContext = null;
    let executionContext = null;
    let statisticContext = null;
    let visibilityContext = null;
    const waitingForGmDc = Boolean(this.pendingGmDcRequest);
    const executionInFlight = Boolean(this.executionInFlight);
    const interactionLocked = waitingForGmDc || executionInFlight;

    if (activeDefinition) {
      targetResolver.activate(activeDefinition);
      const targetState = targetResolver.getState(activeDefinition);
      const manualDc = this.manualDcByAction.get(activeDefinition.id) ?? null;
      const selectedStatistic = this.#getSelectedStatistic(activeDefinition, resolution.actor);
      const dcState = dcResolver.getState(activeDefinition, targetState, { manualDc, statistic: selectedStatistic, actor: resolution.actor });
      statisticContext = this.#prepareStatisticContext(activeDefinition, resolution.actor, selectedStatistic);
      visibilityContext = activeDefinition.execution.mode === "exploration-activity"
        ? null
        : this.#prepareVisibilityContext(activeDefinition);

      const targetHintKey =
        targetState.mode === "single" && !targetState.required
          ? "PF2EActionForge.Target.Hint.singleOptional"
          : `PF2EActionForge.Target.Hint.${targetState.mode}`;

      targetContext = {
        ...targetState,
        modeLabel: game.i18n.localize(`PF2EActionForge.Target.Mode.${targetState.mode}`),
        hint: game.i18n.localize(targetHintKey),
        canUsePicker: targetPickerService.isAvailable(),
        targets: targetState.targets.map((entry) => ({
          key: entry.key,
          name: entry.name,
          img: entry.img,
          actorUuid: entry.actorUuid,
          tokenUuid: entry.tokenUuid,
          source: entry.source,
          remote: Boolean(entry.remote),
          blockedActionId: entry.blockedActionId ?? null,
          sourceText: game.i18n.localize(`PF2EActionForge.Target.Source.${entry.source}`)
        }))
      };

      dcContext = this.#prepareDcContext(activeDefinition, dcState, { waitingForGmDc });
      const systemActionAvailable = activeDefinition.execution.enabled
        ? pf2eActionAdapter.isAvailable(activeDefinition)
        : false;
      const statisticValid = !activeDefinition.execution.requiresStatistic || Boolean(selectedStatistic);
      const proficiencyValid = this.#meetsMinimumRank(activeDefinition, resolution.actor, selectedStatistic);
      const targetCountValid = !activeDefinition.execution.singleTargetOnly || targetState.count <= 1;
      const gmHandoffRequired = Boolean(dcState.requiresGmHandoff && !game.user?.isGM);
      const gmHandoffAvailable = !gmHandoffRequired || gmDcHandoff.isAvailable();
      const activeImmunity = this.#getBlockingImmunity(activeDefinition, targetState, resolution.actor);
      const immunityValid = !activeImmunity;
      const canExecute = Boolean(
        resolution.actor &&
        activeDefinition.execution.enabled &&
        systemActionAvailable &&
        targetState.valid &&
        dcState.valid &&
        statisticValid &&
        proficiencyValid &&
        targetCountValid &&
        immunityValid &&
        gmHandoffAvailable &&
        !interactionLocked
      );

      executionContext = {
        enabled: activeDefinition.execution.enabled,
        systemActionAvailable,
        canExecute,
        statisticValid,
        proficiencyValid,
        targetCountValid,
        immunityValid,
        activeImmunity,
        gmHandoffRequired,
        gmHandoffAvailable,
        waitingForGmDc,
        executionInFlight,
        activity: ["activity", "exploration-activity"].includes(activeDefinition.execution.mode),
        explorationActivity: activeDefinition.execution.mode === "exploration-activity",
        buttonText: game.i18n.localize(
          executionInFlight
            ? "PF2EActionForge.Roll.Executing"
            : waitingForGmDc
              ? "PF2EActionForge.GMDC.WaitingButton"
              : gmHandoffRequired
                ? "PF2EActionForge.GMDC.RequestButton"
                : activeDefinition.execution.mode === "exploration-activity"
                  ? "PF2EActionForge.Exploration.Start"
                  : activeDefinition.execution.mode === "activity"
                    ? "PF2EActionForge.Roll.StartActivity"
                    : "PF2EActionForge.Roll.Execute"
        ),
        constraintText: executionInFlight
          ? game.i18n.localize("PF2EActionForge.Roll.ExecutingHint")
          : !targetCountValid
          ? game.i18n.localize("PF2EActionForge.Roll.SingleTargetOnly")
          : !statisticValid
            ? game.i18n.localize("PF2EActionForge.Roll.StatisticRequired")
            : !proficiencyValid
              ? game.i18n.localize("PF2EActionForge.Roll.ProficiencyRequired")
              : !immunityValid
                ? game.i18n.format("PF2EActionForge.Application.ActionTargetImmune", { action: game.i18n.localize(activeDefinition.label) })
                : gmHandoffRequired && !gmHandoffAvailable
              ? game.i18n.localize("PF2EActionForge.GMDC.NoActiveGM")
              : waitingForGmDc
                ? game.i18n.localize("PF2EActionForge.GMDC.Waiting")
                : "",
        unavailableText: !activeDefinition.execution.enabled
          ? game.i18n.localize("PF2EActionForge.Roll.LaterBlock")
          : !systemActionAvailable
            ? game.i18n.localize("PF2EActionForge.Roll.SystemActionMissing")
            : ""
      };
    }

    return {
      ...context,
      moduleVersion: game.modules.get("pf2e-action-forge")?.version ?? "0.1.0-dev.14.1",
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
      sourceActorLocked: resolution.actionLocked,
      interactionLocked,
      executionInFlight,
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
      statisticContext,
      visibilityContext,
      executionContext,
      activeExploration,
      lastRoll: this.lastRoll
    };
  }

  async _preClose(options) {
    this.pendingGmDcRequest = null;
    this.executionInFlight = false;
    this.activeActionId = null;
    targetResolver.clear();
    actorResolver.unlockActionActor();
    return super._preClose(options);
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

    const statisticSelect = this.element.querySelector('[data-role="execution-statistic"]');
    statisticSelect?.addEventListener("change", (event) => {
      if (!this.activeActionId || this.pendingGmDcRequest) return;
      const value = event.currentTarget.value || null;
      if (value) this.statisticByAction.set(this.activeActionId, value);
      else this.statisticByAction.delete(this.activeActionId);
      this.lastRoll = null;
      this.render({ force: true });
    });

    const manualDcInput = this.element.querySelector('[data-role="manual-dc"]');
    manualDcInput?.addEventListener("input", (event) => {
      if (!this.activeActionId || this.pendingGmDcRequest) return;
      const action = actionRegistry.get(this.activeActionId);
      // Free-form DC entry is GM-only. The resolver also enforces this, so a
      // player cannot bypass the UI by editing the DOM or dispatching input.
      if (!game.user?.isGM) return;
      this.manualDcByAction.set(this.activeActionId, event.currentTarget.value ?? "");
      this.#updateExecutionControls();
    });

    const fixedChoiceDc = this.element.querySelector('[data-role="fixed-choice-dc"]');
    fixedChoiceDc?.addEventListener("change", (event) => {
      if (!this.activeActionId || this.pendingGmDcRequest) return;
      this.manualDcByAction.set(this.activeActionId, event.currentTarget.value ?? "");
      this.lastRoll = null;
      this.render({ force: true });
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
    this.#restoreUiStateAfterRender();
    this.#scrollToExecutionAfterRender();
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

  #prepareDcContext(action, state, { waitingForGmDc = false } = {}) {
    const sourceText = (() => {
      if (state.source === "target") {
        return game.i18n.format("PF2EActionForge.DC.TargetDefense", {
          defense: game.i18n.localize(state.labelKey),
          target: state.target?.name ?? ""
        });
      }
      if (state.source === "system-target") {
        return game.i18n.format("PF2EActionForge.DC.SystemTargetValue", { target: state.target?.name ?? "" });
      }
      if (state.source === "target-dying") {
        return game.i18n.format("PF2EActionForge.DC.DyingRecoveryValue", {
          target: state.target?.name ?? "",
          dying: state.dyingValue ?? "",
          dc: state.difficultyClass ?? ""
        });
      }
      if (state.source === "gm") {
        return game.i18n.localize(state.labelKey ?? "PF2EActionForge.DC.GMDefined");
      }
      if (state.source === "manual" && state.manualDc !== null) {
        return game.i18n.format("PF2EActionForge.DC.ManualValue", { dc: state.manualDc });
      }
      if (state.source === "fixed") {
        return game.i18n.format("PF2EActionForge.DC.FixedValue", { dc: state.difficultyClass ?? "" });
      }
      return game.i18n.localize(state.labelKey);
    })();

    const handoffRequired = Boolean(state.requiresGmHandoff && !game.user?.isGM);
    const statusKey = waitingForGmDc
      ? "PF2EActionForge.GMDC.Waiting"
      : handoffRequired
        ? "PF2EActionForge.GMDC.Required"
        : state.valid
          ? "PF2EActionForge.DC.Ready"
          : "PF2EActionForge.DC.Required";

    return {
      ...state,
      sourceText,
      statusText: game.i18n.localize(statusKey),
      waitingForGmDc,
      handoffRequired,
      statusClass: waitingForGmDc || handoffRequired ? "is-waiting" : state.valid ? "is-valid" : "is-required",
      showChoiceSelect: state.strategy === "fixed-choice" && Array.isArray(state.choiceEntries) && state.choiceEntries.length > 0,
      choiceOptions: [
        ...(state.choiceEntries ?? []).map((entry) => ({
          value: entry.value,
          selected: entry.value === state.manualDc,
          label: game.i18n.format("PF2EActionForge.DC.FixedChoiceOption", {
            dc: entry.value,
            label: entry.label ? game.i18n.localize(entry.label) : ""
          })
        })),
        ...(state.custom
          ? [{
              value: state.manualDc,
              selected: true,
              label: game.i18n.format("PF2EActionForge.DC.CustomChoiceOption", { dc: state.manualDc })
            }]
          : [])
      ],
      choiceLabel: game.i18n.localize(action?.dc?.choiceLabel ?? "PF2EActionForge.DC.FixedChoiceLabel"),
      choiceHint: game.i18n.localize(action?.dc?.choiceHint ?? "PF2EActionForge.DC.FixedChoiceHint"),
      showManualInput:
        (state.strategy === "manual" && state.allowsManualDc) ||
        (state.strategy === "fixed-choice" && state.allowsManualDc) ||
        (state.strategy === "gm-defined" && state.allowsManualDc) ||
        (state.strategy === "target-dying" && state.allowsManualDc) ||
        (state.strategy === "target-defense" && !state.target && state.allowsManualDc),
      manualInputValue: this.manualDcByAction.get(action.id) ?? state.manualDc ?? "",
      manualInputLabel: game.i18n.localize(action?.dc?.customLabel ?? "PF2EActionForge.DC.ManualInput"),
      manualInputHint: game.i18n.localize(action?.dc?.customHint ?? "PF2EActionForge.DC.ManualInputHint")
    };
  }

  #meetsMinimumRank(action, actor, selectedStatistic = null) {
    const minimum = Number(action?.execution?.minRank ?? 0);
    if (!minimum) return true;
    const statistic = selectedStatistic ?? action?.execution?.statistic ?? null;
    const rank = statisticRank(actor, statistic);
    return rank !== null && rank >= minimum;
  }

  #getBlockingImmunity(action, targetState, sourceActor) {
    const actionId = action?.application?.blockIfImmuneActionId;
    const targetEntry = targetState?.targets?.[0] ?? null;
    if (!actionId || !targetEntry) return null;
    if (targetEntry.blockedActionId === actionId) return { remote: true, actionId };
    const targetActor = targetEntry.actor ?? null;
    if (!targetActor) return null;
    return applicationEngine.getActiveImmunity(targetActor, actionId, { sourceActor });
  }

  #getSelectedStatistic(action, actor) {
    if (action?.execution?.statistic) return action.execution.statistic;
    if (!action?.execution?.requiresStatistic) return null;
    const selected = this.statisticByAction.get(action.id) ?? null;
    if (!selected) return null;
    return this.#getStatisticOptions(action, actor).some((entry) => entry.slug === selected) ? selected : null;
  }

  #getStatisticOptions(action, actor) {
    if (!actor) return [];
    const options = new Map();
    const localizeLabel = (slug, statistic = null) => {
      if (slug === "unarmed") return game.i18n.localize("PF2EActionForge.Roll.Unarmed");
      const label = statistic?.label ?? actor.getStatistic?.(slug)?.label ?? globalThis.CONFIG?.PF2E?.skills?.[slug]?.label;
      return label ? game.i18n.localize(label) : slug;
    };
    const modifierFor = (slug, statistic = null) => {
      const candidate = statistic?.mod ?? statistic?.check?.mod ?? actor.getStatistic?.(slug)?.mod;
      return Number.isFinite(candidate) ? Number(candidate) : null;
    };

    for (const slug of action.execution.statistics ?? []) {
      const statistic = actor.skills?.[slug] ?? actor.getStatistic?.(slug) ?? null;
      options.set(slug, { slug, label: localizeLabel(slug, statistic), modifier: modifierFor(slug, statistic), lore: false });
    }

    if (action.execution.includeLore) {
      for (const [slug, statistic] of Object.entries(actor.skills ?? {})) {
        if (!statistic?.lore) continue;
        options.set(slug, { slug, label: localizeLabel(slug, statistic), modifier: modifierFor(slug, statistic), lore: true });
      }
    }

    return [...options.values()]
      .map((entry) => ({
        ...entry,
        displayLabel: entry.modifier === null
          ? entry.label
          : `${entry.label} (${entry.modifier >= 0 ? "+" : ""}${entry.modifier})`
      }))
      .sort((a, b) => Number(a.lore) - Number(b.lore) || a.label.localeCompare(b.label, game.i18n.lang));
  }

  #prepareStatisticContext(action, actor, selectedStatistic) {
    if (!action?.execution?.requiresStatistic) return null;
    const options = this.#getStatisticOptions(action, actor).map((entry) => ({
      ...entry,
      selected: entry.slug === selectedStatistic
    }));
    return {
      required: true,
      selected: selectedStatistic,
      options,
      hasOptions: options.length > 0,
      label: game.i18n.localize(action?.execution?.statisticLabel ?? "PF2EActionForge.Roll.Statistic"),
      hint: game.i18n.localize(
        action?.execution?.statisticHint
          ?? (action?.execution?.includeLore ? "PF2EActionForge.Roll.StatisticHint" : "PF2EActionForge.Roll.StatisticHintNoLore")
      )
    };
  }

  #prepareVisibilityContext(action) {
    const profile = action.visibility;
    const row = (key, mode) => ({
      label: game.i18n.localize(`PF2EActionForge.Visibility.${key}`),
      value: game.i18n.localize(`PF2EActionForge.Visibility.Mode.${mode}`),
      mode
    });
    return {
      rows: [
        row("Announcement", profile.announcement),
        row("Roll", profile.roll),
        row("Outcome", profile.outcome)
      ],
      secret: [profile.roll, profile.outcome].some((mode) => ["blind", "gm"].includes(mode))
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
    const actor = actorResolver.resolve();
    const selectedStatistic = this.#getSelectedStatistic(action, actor);
    const dcState = dcResolver.getState(action, targetState, { manualDc, statistic: selectedStatistic, actor });
    const systemActionAvailable = action.execution.enabled ? pf2eActionAdapter.isAvailable(action) : false;
    const statisticValid = !action.execution.requiresStatistic || Boolean(selectedStatistic);
    const proficiencyValid = this.#meetsMinimumRank(action, actor, selectedStatistic);
    const targetCountValid = !action.execution.singleTargetOnly || targetState.count <= 1;
    const immunityValid = !this.#getBlockingImmunity(action, targetState, actor);
    const waitingForGmDc = Boolean(this.pendingGmDcRequest);
    const executionInFlight = Boolean(this.executionInFlight);
    const gmHandoffRequired = Boolean(dcState.requiresGmHandoff && !game.user?.isGM);
    const gmHandoffAvailable = !gmHandoffRequired || gmDcHandoff.isAvailable();
    const canExecute = Boolean(
      actor && action.execution.enabled && systemActionAvailable && targetState.valid && dcState.valid && statisticValid &&
      proficiencyValid && targetCountValid && immunityValid && gmHandoffAvailable && !waitingForGmDc && !executionInFlight
    );

    const button = this.element.querySelector('[data-action="executeAction"]');
    if (button) button.disabled = !canExecute;

    const status = this.element.querySelector('[data-role="dc-status"]');
    if (status) {
      const waiting = executionInFlight || waitingForGmDc || gmHandoffRequired;
      status.classList.toggle("is-valid", !waiting && dcState.valid);
      status.classList.toggle("is-required", !waiting && !dcState.valid);
      status.classList.toggle("is-waiting", waiting);
      const icon = status.querySelector("i");
      icon?.classList.toggle("fa-check", !waiting && dcState.valid);
      icon?.classList.toggle("fa-circle-exclamation", !waiting && !dcState.valid);
      icon?.classList.toggle("fa-hourglass-half", waiting);
      const text = status.querySelector("span");
      if (text) {
        text.textContent = game.i18n.localize(
          executionInFlight
            ? "PF2EActionForge.Roll.ExecutingHint"
            : waitingForGmDc
              ? "PF2EActionForge.GMDC.Waiting"
              : gmHandoffRequired
              ? "PF2EActionForge.GMDC.Required"
              : dcState.valid
                ? "PF2EActionForge.DC.Ready"
                : "PF2EActionForge.DC.Required"
        );
      }
    }
  }

  async #handleTargetDrop(event) {
    if (this.pendingGmDcRequest || this.executionInFlight) return;
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
    if (!app || app.pendingGmDcRequest || app.executionInFlight) return;
    actorResolver.lockActionActor(actor);
    app.activeActionId = action.id;
    app.lastRoll = null;
    app._scrollToExecutionAfterRender = true;
    targetResolver.activate(action);
    app.render({ force: true });
  }

  static async #executeAction(event) {
    event?.preventDefault?.();
    const app = ActionForgeApp.instance;
    if (app?.pendingGmDcRequest || app?.executionInFlight) return;
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

    const selectedStatistic = app.#getSelectedStatistic(action, actor);
    if (action.execution.requiresStatistic && !selectedStatistic) {
      ui.notifications.warn(game.i18n.localize("PF2EActionForge.Notifications.StatisticRequired"));
      return;
    }
    if (action.execution.singleTargetOnly && targetState.count > 1) {
      ui.notifications.warn(game.i18n.localize("PF2EActionForge.Notifications.SingleTargetOnly"));
      return;
    }
    if (!app.#meetsMinimumRank(action, actor, selectedStatistic)) {
      ui.notifications.warn(game.i18n.localize("PF2EActionForge.Roll.ProficiencyRequired"));
      return;
    }
    if (app.#getBlockingImmunity(action, targetState, actor)) {
      ui.notifications.warn(game.i18n.format("PF2EActionForge.Application.ActionTargetImmune", { action: game.i18n.localize(action.label) }));
      return;
    }

    const manualDc = app.manualDcByAction.get(action.id) ?? null;
    const dcResolution = dcResolver.resolve(action, targetState, { manualDc, statistic: selectedStatistic, actor });
    if (!dcResolution.ok) {
      ui.notifications.warn(game.i18n.localize("PF2EActionForge.Notifications.DCRequired"));
      return;
    }

    let difficultyClass = dcResolution.difficultyClass;
    if (dcResolution.state.requiresGmHandoff && !game.user?.isGM) {
      const requestId = gmDcHandoff.createRequestId();
      const statisticEntry = app.#getStatisticOptions(action, actor).find((entry) => entry.slug === selectedStatistic);
      app.pendingGmDcRequest = { requestId, actionId: action.id };
      app.render({ force: true });

      const handoff = await gmDcHandoff.request({
        definition: action,
        actor,
        target: targetState.targets[0] ?? null,
        statisticLabel: statisticEntry?.displayLabel ?? selectedStatistic ?? "",
        requestId
      });

      // The player may have cancelled the action while the remote GM dialog was open.
      if (app.pendingGmDcRequest?.requestId !== requestId) return;
      app.pendingGmDcRequest = null;

      if (!handoff.ok) {
        const key = {
          "no-active-gm": "PF2EActionForge.GMDC.NoActiveGM",
          rejected: "PF2EActionForge.GMDC.Rejected",
          "invalid-dc": "PF2EActionForge.GMDC.Invalid",
          "dialog-query-unavailable": "PF2EActionForge.GMDC.Unavailable",
          "query-error": "PF2EActionForge.GMDC.Unavailable"
        }[handoff.reason] ?? "PF2EActionForge.GMDC.Unavailable";
        ui.notifications.warn(game.i18n.localize(key));
        app.render({ force: true });
        return;
      }

      difficultyClass = handoff.dc;
    }

    // Lock the workspace before the first asynchronous PF2e roll call. This
    // prevents double-clicks, target mutation and action switching from creating
    // duplicate checks while the system roll dialog/result pipeline is active.
    app.executionInFlight = true;
    app.render({ force: true });
    let actionCompleted = false;

    try {
      const execution = await pf2eActionAdapter.execute({
        definition: action,
        actor,
        target: dcResolution.target,
        difficultyClass,
        statistic: selectedStatistic,
        event
      });

      if (!execution.ok) {
        const key = {
          "missing-system-action": "PF2EActionForge.Notifications.SystemActionMissing",
          "missing-statistic": "PF2EActionForge.Notifications.StatisticRequired",
          "execution-error": "PF2EActionForge.Notifications.RollFailed",
          "not-enabled": "PF2EActionForge.Roll.LaterBlock"
        }[execution.reason] ?? "PF2EActionForge.Notifications.RollFailed";
        ui.notifications.error(game.i18n.localize(key));
        return;
      }

      // Even a cancelled PF2e roll dialog is a completed attempt from the Forge's
      // perspective: the frozen source/target session can be safely released.
      actionCompleted = true;
      if (execution.explorationActivity) {
        const stored = await explorationActivityService.set(actor, action, {
          statistic: selectedStatistic,
          targetEntry: targetState.targets[0] ?? null
        });
        if (!stored.ok) {
          actionCompleted = false;
          ui.notifications.error(game.i18n.localize("PF2EActionForge.Exploration.StoreFailed"));
          return;
        }
        ui.notifications.info(game.i18n.format("PF2EActionForge.Exploration.Started", { action: game.i18n.localize(action.label) }));
        return;
      }
      if (execution.activity) {
        await visibilityEngine.createAnnouncement({ definition: action, actor, force: true });
        return;
      }

      const result = execution.results.at(-1) ?? null;
      if (!result) return;

      await visibilityEngine.createAnnouncement({ definition: action, actor });
      const canReveal = visibilityEngine.shouldRevealLocalResult(action, game.user);
      const outcome = result.outcome ?? "unknown";
      app.lastRoll = canReveal
        ? {
            actionId: action.id,
            actionName: game.i18n.localize(action.label),
            total: Number.isFinite(result.roll?.total) ? result.roll.total : "–",
            outcome,
            outcomeText: game.i18n.localize(`PF2EActionForge.Roll.Outcome.${outcome}`),
            actorName: actor.name,
            hidden: false
          }
        : {
            actionId: action.id,
            actionName: game.i18n.localize(action.label),
            actorName: actor.name,
            hidden: true,
            hiddenText: game.i18n.localize("PF2EActionForge.Roll.HiddenResult")
          };

      const targetEntry = targetState.targets[0] ?? null;
      if (
        targetEntry?.actorUuid &&
        applicationEngine.hasApplications(action, outcome) &&
        visibilityEngine.canExposeOutcome(action, game.user)
      ) {
        const transaction = ActionTransaction.create({
          definition: action,
          actor,
          targetEntry,
          outcome,
          difficultyClass: Number.isFinite(Number(difficultyClass)) ? Number(difficultyClass) : null,
          statistic: selectedStatistic,
          rollMessageId: result.message?.id ?? result.messageId ?? null
        });
        await applicationChat.create({ definition: action, transaction });
      }
    } catch (error) {
      console.error("PF2E Action Forge | Post-roll workflow failed", error);
      ui.notifications.error(game.i18n.localize("PF2EActionForge.Notifications.PostRollFailed"));
    } finally {
      app.executionInFlight = false;
      if (actionCompleted) {
        actorResolver.unlockActionActor();
        app.activeActionId = null;
        targetResolver.clear();
      }
      app.render({ force: true });
    }
  }

  static async #removeTarget(event, target) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const app = ActionForgeApp.instance;
    if (app?.pendingGmDcRequest || app?.executionInFlight) return;
    const key = target?.dataset?.targetKey;
    if (!key) return;
    await targetResolver.remove(key);
    if (app) app.lastRoll = null;
    app?.render({ force: true });
  }

  static async #pickTarget(event) {
    event?.preventDefault?.();
    const app = ActionForgeApp.instance;
    if (!app || app.pendingGmDcRequest || app.executionInFlight) return;
    const action = app.activeActionId ? actionRegistry.get(app.activeActionId) : null;
    const actor = actorResolver.resolve();
    if (!action || !actor) return;

    const result = await targetPickerService.choose({ definition: action, sourceActor: actor });
    if (!result.ok) {
      if (result.reason === "cancelled") return;
      const key = {
        "no-active-gm": "PF2EActionForge.Target.Picker.NoActiveGM",
        "no-targets": "PF2EActionForge.Target.Picker.NoTargets",
        "dialog-unavailable": "PF2EActionForge.Target.Picker.Unavailable",
        "dialog-error": "PF2EActionForge.Target.Picker.Unavailable",
        timeout: "PF2EActionForge.Target.Picker.Timeout",
        "gm-directory-error": "PF2EActionForge.Target.Picker.DirectoryError",
        "query-failed": "PF2EActionForge.Target.Picker.BrokerUnavailable",
        blocked: "PF2EActionForge.TreatWounds.TargetImmune"
      }[result.reason] ?? "PF2EActionForge.Target.Picker.Unavailable";
      ui.notifications.warn(game.i18n.localize(key));
      return;
    }

    const added = await targetResolver.addFromPickerEntry(result.entry, action);
    if (!added.ok) {
      ui.notifications.warn(game.i18n.localize("PF2EActionForge.Notifications.TargetDropInvalid"));
      return;
    }
    app.lastRoll = null;
    app.render({ force: true });
  }

  static #useCanvasTargets(event) {
    event?.preventDefault?.();
    const app = ActionForgeApp.instance;
    if (app?.pendingGmDcRequest || app?.executionInFlight) return;
    const action = app?.activeActionId ? actionRegistry.get(app.activeActionId) : null;
    if (!action) return;
    targetResolver.preferCanvas(action);
    app.lastRoll = null;
    app.render({ force: true });
  }

  static #closeActionSelection(event) {
    event?.preventDefault?.();
    const app = ActionForgeApp.instance;
    if (!app || app.executionInFlight) return;
    app.pendingGmDcRequest = null;
    app.activeActionId = null;
    app.lastRoll = null;
    targetResolver.clear();
    actorResolver.unlockActionActor();
    app.render({ force: true });
  }

  static async #clearExplorationActivity(event) {
    event?.preventDefault?.();
    const app = ActionForgeApp.instance;
    if (app?.pendingGmDcRequest || app?.executionInFlight) return;
    const actor = actorResolver.resolve();
    if (!actor) {
      ui.notifications.warn(game.i18n.localize("PF2EActionForge.Notifications.NoActor"));
      return;
    }

    const result = await explorationActivityService.clear(actor);
    if (!result.ok) {
      ui.notifications.error(game.i18n.localize("PF2EActionForge.Exploration.ClearFailed"));
      return;
    }
    ui.notifications.info(game.i18n.localize("PF2EActionForge.Exploration.Cleared"));
    app?.render({ force: true });
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
