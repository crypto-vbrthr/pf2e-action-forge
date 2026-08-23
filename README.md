# PF2E Action Forge

Development build **0.1.0-dev.4.2 – Source Actor Lock Hotfix**.

This block connects the Action Forge target layer to the first real PF2e checks. The module now resolves an action's DC strategy, hands the check to the PF2e system action implementation, and keeps Action Forge responsible for orchestration rather than rebuilding PF2e roll logic.

## Included in dev.4.2

- Foundry VTT v14 / PF2e 8.4.0+ module foundation;
- German and English localization;
- Token SceneControl launcher for GM and players;
- `ApplicationV2` + Handlebars application;
- acting-Actor resolver with **Current token (automatic)**, manual pinning, and an action-session source lock;
- player access to owned characters/companions plus PF2e familiars whose master is owned;
- eight-action MVP catalog, search, and per-user favorites;
- canvas-token and sidebar-Actor target resolution;
- declarative DC strategies: `none`, `manual`, `target-defense`, `fixed`, `fixed-choice`, and `gm-defined`;
- manual-DC validation and manual fallback for actions that normally use a target defense;
- PF2e Action Adapter for delegating checks to the installed PF2e action implementation;
- real **Tumble Through** and **Climb** checks;
- compact DC readiness/status UI and last-check display;
- release metadata, `CHANGELOG.md`, and MIT `LICENSE`.


### Frozen acting Actor during an action

As soon as an action is selected, Action Forge snapshots and locks the currently resolved acting Actor. Changing token control while targeting creatures on the canvas no longer changes who performs the in-progress action. The source selector is disabled and shows a lock badge for the duration of the action session.

When the PF2e action finishes, its roll dialog is cancelled, or the Action Forge action workspace is closed, the source lock is released. **Current token (automatic)** then follows the currently controlled token again; a deliberately pinned Actor remains pinned.

### Sidebar target precedence

For single/optional target actions, dropping an Actor into the Action Forge target field is now an explicit authoritative target choice. Any stale native canvas targets are released. When the dropped Actor has no token, Action Forge resolves the prepared defense DC directly from that Actor and still passes the Actor to PF2e as the roll target. This keeps the DC correct for sidebar-only targets and prevents a different targeted token from leaking into the check.

## First real checks

### Tumble Through

With one creature selected as target, Action Forge passes that target and the Reflex defense to the PF2e system action. The numeric defense value does not need to be exposed in the Action Forge UI.

With no target selected, Tumble Through remains usable and offers a manual DC field. This supports Theater-of-the-Mind play and situations where the relevant creature is not represented by an accessible Actor.

### Climb

Climb does not use an Actor target. Action Forge therefore requires a manual environmental DC before the Roll button becomes available.

Both checks are delegated to PF2e rather than reconstructing the actor's statistic or situational modifiers in the module.

## DC metadata prepared for the MVP

The remaining six MVP actions already carry their intended DC metadata, but their complete roll workflows remain disabled until their dedicated blocks:

- **Recall Knowledge**: GM/manual DC;
- **Grapple**: target Fortitude DC, manual fallback;
- **Trip**: target Reflex DC, manual fallback;
- **Lie**: target Perception DC, manual fallback;
- **Demoralize**: target Will DC, manual fallback;
- **Treat Wounds**: selectable rules DCs 15/20/30/40.

## Manual test

1. Enable the module in a PF2e world and open Action Forge from the Token Controls hammer button.
2. In **Current token (automatic)** mode, control Actor A and select **Tumble Through**. Confirm the source selector becomes disabled and shows the lock state.
3. Change token control to Actor B while selecting/changing the target. Confirm Actor A remains the acting Actor and supplies the check.
4. Close the action workspace with its X button. Confirm the lock releases and the acting Actor now follows Actor B.
5. Repeat with a deliberately pinned source Actor. Cancel the action and confirm the explicit pin remains selected.
6. Select **Tumble Through** and target a creature token on the canvas. Confirm the DC panel reports that target's Reflex DC source without requiring manual input.
7. Click **Roll**. Confirm the normal PF2e check workflow/chat output appears, the action workspace closes, and the last-result summary remains visible in Action Forge.
8. Remove all targets, select Tumble Through again, and confirm a manual DC field appears. The Roll button must remain disabled until a valid integer DC is entered.
9. Enter a manual DC and roll Tumble Through again. Confirm the check works without an Actor target.
10. Drag a visible Actor from the sidebar into Tumble Through. Confirm the target-defense mode is restored and the manual field disappears.
11. Select **Climb**. Confirm no Actor target is requested and a manual DC is required.
12. Enter a DC and roll. Confirm PF2e uses the acting Actor's Athletics check and normal PF2e modifiers/options remain available.
13. Select Grapple, Trip, Lie, Demoralize, Recall Knowledge, and Treat Wounds. Confirm their DC source is previewed, while their Roll workflow clearly states that it belongs to a later development block.
14. Confirm source-Actor selection, target drag-and-drop, search, and favorites from earlier builds still work.

## Automated checks

```bash
npm test
npm run check
```

The next planned block is **0.1.0-dev.5 – Visibility Profiles**.
