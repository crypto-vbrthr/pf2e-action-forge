import { actionRegistry } from "./core/action-registry.js";
import { CORE_ACTIONS } from "./data/core-action-catalog.js";
import { ActionForgeApp } from "./ui/action-forge-app.js";
import { registerActionForgeSceneControl } from "./ui/scene-controls.js";

const MODULE_ID = "pf2e-action-forge";

Hooks.once("init", () => {
  actionRegistry.registerMany(CORE_ACTIONS);

  const module = game.modules.get(MODULE_ID);
  if (module) {
    module.api = Object.freeze({
      open: () => ActionForgeApp.open(),
      actions: Object.freeze({
        get: (id) => actionRegistry.get(id),
        list: () => actionRegistry.list()
      })
    });
  }

  console.info(`PF2E Action Forge | Initialized ${module?.version ?? "0.1.0-dev.2"}`);
});

Hooks.on("getSceneControlButtons", (controls) => {
  registerActionForgeSceneControl(controls, () => ActionForgeApp.open());
});

Hooks.on("controlToken", () => {
  ActionForgeApp.refreshIfOpen();
});

Hooks.on("updateUser", (user, changes) => {
  if (user.id !== game.user.id) return;
  if (!("character" in changes) && !("flags" in changes)) return;
  ActionForgeApp.refreshIfOpen();
});
