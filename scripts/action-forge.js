import { actionRegistry } from "./core/action-registry.js";
import { applicationBroker } from "./core/application-broker.js";
import { applicationChat } from "./core/application-chat.js";
import { CORE_ACTIONS } from "./data/core-action-catalog.js";
import { ActionForgeApp } from "./ui/action-forge-app.js";
import { registerActionForgeSceneControl } from "./ui/scene-controls.js";
import { targetPickerService } from "./core/target-picker-service.js";
import { sharedRollResolver } from "./core/shared-roll-resolver.js";
import { explorationActivityService } from "./core/exploration-activity-service.js";
import { prerequisiteBroker } from "./core/prerequisite-broker.js";
import { gmDcHandoff } from "./core/gm-dc-handoff.js";
import { gmDcDebugLog } from "./core/gm-dc-debug.js";

const MODULE_ID = "pf2e-action-forge";

Hooks.once("init", () => {
  actionRegistry.registerMany(CORE_ACTIONS);
  applicationBroker.registerQueryHandler();
  targetPickerService.registerQueryHandler();
  sharedRollResolver.registerQueryHandler();
  prerequisiteBroker.registerQueryHandler();
  gmDcHandoff.registerQueryHandler();

  const module = game.modules.get(MODULE_ID);
  if (module) {
    module.api = Object.freeze({
      open: () => ActionForgeApp.open(),
      actions: Object.freeze({
        get: (id) => actionRegistry.get(id),
        list: () => actionRegistry.list()
      }),
      exploration: Object.freeze({
        get: (actor) => explorationActivityService.get(actor),
        clear: (actor) => explorationActivityService.clear(actor)
      }),
      debug: Object.freeze({
        getGmDc: () => gmDcDebugLog.snapshot(),
        getGmDcText: () => gmDcDebugLog.text(),
        showGmDc: () => gmDcDebugLog.show(),
        copyGmDc: () => gmDcDebugLog.copy(),
        clearGmDc: () => gmDcDebugLog.clear()
      })
    });
  }

  console.info(`PF2E Action Forge | Initialized ${module?.version ?? "0.1.0-rc.1"}`);
});

Hooks.on("getSceneControlButtons", (controls) => {
  registerActionForgeSceneControl(controls, () => ActionForgeApp.open());
});

Hooks.on("controlToken", () => {
  ActionForgeApp.refreshIfOpen();
});

Hooks.on("targetToken", (user, _token, targeted) => {
  if (user?.id !== game.user.id) return;
  ActionForgeApp.refreshTargetsIfOpen({ preferCanvas: Boolean(targeted) });
});

Hooks.on("canvasReady", () => {
  ActionForgeApp.refreshTargetsIfOpen();
});

Hooks.on("updateUser", (user, changes) => {
  if (user.id !== game.user.id) return;
  if (!("character" in changes) && !("flags" in changes)) return;
  ActionForgeApp.refreshIfOpen();
});

Hooks.on("updateActor", (_actor, changes) => {
  if (!changes?.flags || !(MODULE_ID in changes.flags)) return;
  ActionForgeApp.refreshIfOpen();
});

Hooks.once("ready", () => {
  applicationBroker.initialize();
  targetPickerService.initialize();
  gmDcHandoff.initialize();
  applicationChat.bindGlobalClickHandler();
});

const decorateApplicationMessage = (message, html) => applicationChat.decorate(message, html);
Hooks.on("renderChatMessage", decorateApplicationMessage);
Hooks.on("renderChatMessageHTML", decorateApplicationMessage);
