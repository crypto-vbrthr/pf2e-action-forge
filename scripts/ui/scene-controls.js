const MODULE_ID = "pf2e-action-forge";
const TOOL_NAME = "actionForge";

/**
 * Register the Action Forge button in Foundry VTT v14's Token SceneControl.
 *
 * V14 exposes controls as a Record<string, SceneControl> and tools as a
 * Record<string, SceneControlTool>. SceneControlTool.order is required.
 */
export function registerActionForgeSceneControl(controls, open) {
  const tokenControl = controls?.tokens;
  if (!tokenControl?.tools) return false;

  if (tokenControl.tools[TOOL_NAME]) return true;

  const orders = Object.values(tokenControl.tools)
    .map((tool) => Number(tool?.order))
    .filter(Number.isFinite);
  const order = (orders.length ? Math.max(...orders) : -1) + 1;

  tokenControl.tools[TOOL_NAME] = {
    name: TOOL_NAME,
    title: "PF2EActionForge.Controls.Open",
    icon: "fa-solid fa-hammer",
    order,
    button: true,
    visible: true,
    onChange: () => open()
  };

  return true;
}
