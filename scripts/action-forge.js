import { actionRegistry } from "./core/action-registry.js";
import { ActionForgeApp } from "./ui/action-forge-app.js";
import { registerActionForgeSceneControl } from "./ui/scene-controls.js";

const MODULE_ID = "pf2e-action-forge";

Hooks.once("init", () => {
  actionRegistry.register({
    id: "foundation-check",
    label: "PF2EActionForge.Actions.FoundationCheck.Name",
    description: "PF2EActionForge.Actions.FoundationCheck.Description",
    category: "general",
    icon: "fa-solid fa-gears",
    developmentOnly: true
  });

  const module = game.modules.get(MODULE_ID);
  if (module) {
    module.api = Object.freeze({
      open: () => ActionForgeApp.open()
    });
  }

  console.info(`PF2E Action Forge | Initialized ${module?.version ?? "0.1.0-dev.1.3"}`);
});

Hooks.on("getSceneControlButtons", (controls) => {
  registerActionForgeSceneControl(controls, () => ActionForgeApp.open());
});

Hooks.on("controlToken", () => {
  ActionForgeApp.refreshIfOpen();
});

Hooks.on("updateUser", (user, changes) => {
  if (user.id !== game.user.id) return;
  if (!("character" in changes)) return;
  ActionForgeApp.refreshIfOpen();
});
