# PF2E Action Forge

Development build **0.1.0-dev.3 – Targets & Drag-and-Drop**.

This block adds the target-resolution layer that later DC, roll, visibility, and application workflows will use. Actions still do **not** perform PF2e checks yet. Selecting an action now opens its target workspace and makes the action's target requirements explicit.

## Included in dev.3

- Foundry VTT v14 / PF2e 8.4.0+ module foundation;
- German and English localization;
- Token SceneControl launcher for GM and players;
- `ApplicationV2` + Handlebars application;
- acting-Actor resolver with **Current token (automatic)** and manual pinning;
- player access to owned characters/companions plus PF2e familiars whose master is owned;
- declarative Action Registry and eight-action MVP catalog;
- live search and per-user favorites;
- declarative target modes: `none`, `optional`, `single`, and `multiple`;
- automatic use of Foundry's current token targets;
- live refresh when the current user's token targets change;
- Actor targets by drag-and-drop from the sidebar;
- support for dropped Token documents when Foundry provides token drag data;
- target chips with source information and removal controls;
- single-target replacement behavior and multiple-target combination;
- canvas-token context retained separately from Actor UUIDs for later range/scene-aware workflows;
- visibility guards so players cannot use hidden sidebar Actors as target data;
- release metadata, `CHANGELOG.md`, and MIT `LICENSE`.

## Target modes

The MVP actions currently declare these target requirements:

- **Recall Knowledge**: optional creature target;
- **Tumble Through**: one creature target;
- **Grapple**: one creature target;
- **Trip**: one creature target;
- **Climb**: no Actor target;
- **Lie**: multiple creature targets;
- **Demoralize**: one creature target;
- **Treat Wounds**: one creature target.

These modes are metadata only at this stage. The next block will attach DC strategies and PF2e checks to the resolved target context.

## Canvas targets

When an action accepts targets, Action Forge reads `game.user.targets` rather than maintaining a second competing token-target system. Targeting or untargeting tokens on the canvas updates the open Action Forge workspace.

For single-target and optional-target actions, a dropped sidebar Actor temporarily takes precedence. Targeting a token afterwards switches the action back to the native canvas target. If several tokens remain targeted for a single-target action, the most recently targeted token is used and the UI displays a warning.

## Sidebar Actor drag-and-drop

A visible creature Actor can be dragged from the Actors sidebar into the target drop zone. This does **not** require ownership of the target Actor. That is intentional: later player actions such as Treat Wounds, Demoralize, Grapple, or Trip must be able to act on Actors the player does not own.

The drop resolver accepts Actor UUID data and falls back to standard Foundry Actor/Token drag payloads. Hidden Actors are rejected for non-GM users.

## Manual test

1. Enable the module in a PF2e world and open Action Forge from the Token Controls hammer button.
2. Select **Tumble Through**. Confirm a target workspace appears and requires exactly one target.
3. Target a creature token on the canvas. Confirm it appears immediately as a target chip marked **Canvas token**.
4. Untarget it from Foundry or remove it from the chip. Confirm the target workspace updates.
5. Drag a visible NPC or PC Actor from the Actors sidebar into the target field. Confirm it appears as **Actor from sidebar**, even if the acting player does not own that Actor.
6. While the sidebar Actor is selected for a single-target action, target a token on the map. Confirm the native token target takes precedence.
7. Select **Lie**, target multiple tokens, and optionally drag another Actor from the sidebar. Confirm multiple targets are shown and duplicate Actor targets are not repeated.
8. Select **Climb**. Confirm the UI states that no Actor target is needed.
9. Select **Recall Knowledge** with no target. Confirm the optional target state is still valid.
10. Confirm source-Actor selection, search, and favorites from earlier builds still work.

## Automated checks

```bash
npm test
npm run check
```

The next planned block is **0.1.0-dev.4 – DC Resolver & PF2e Roll Adapter**.
