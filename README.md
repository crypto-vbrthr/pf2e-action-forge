# PF2E Action Forge

Development build **0.1.0-dev.5.3 – GM DC Handoff**.

This build completes the secret-DC player workflow: when PF2e cannot determine a secret DC automatically, the player requests it from the GM and the check waits until the GM supplies a valid value.

## Included in dev.5.3

- Foundry VTT v14 / PF2e 8.4.0+ module foundation;
- German and English localization;
- Token SceneControl launcher for GM and players;
- `ApplicationV2` + Handlebars application;
- acting-Actor resolver with **Current token (automatic)**, manual pinning, companions/familiars, and an action-session source lock;
- eight-action MVP catalog, search, and per-user favorites;
- canvas-token and sidebar-Actor target resolution;
- declarative DC Resolver and PF2e Action Adapter;
- real **Tumble Through** and **Climb** checks from dev.4;
- declarative output profiles with separate **announcement / roll / outcome** visibility;
- real secret **Lie** and **Recall Knowledge** checks;
- Recall Knowledge skill selector including the Actor's Lore skills;
- hidden PF2e target-DC delegation for eligible Recall Knowledge checks;
- local secret-result redaction for players;
- visibility-aware player/GM announcement recipients;
- a full-window vertical workspace scrollbar with stable scrollbar space;
- GM-only manual entry for GM-defined/secret DCs, enforced by the resolver as well as the UI;
- GM DC Handoff using Foundry v14's user-targeted DialogV2 query flow;
- frozen source/action/target/statistic context while a secret DC request is pending;
- release metadata, `CHANGELOG.md`, and MIT `LICENSE`.

## Visibility profiles

Each action now defines three independent channels:

- **Announcement**: who is told that the action was attempted;
- **Roll**: who can see the actual PF2e check;
- **Outcome**: who can see the degree of success/result.

The current profile vocabulary is `public`, `player-gm`, `gm`, `blind`, `self`, and `none`. The active action workspace shows the action's defaults so the user knows before rolling where information will go.

Public PF2e roll cards already announce their action, so Action Forge does not create a duplicate public announcement. Restricted announcements can be emitted separately when the action profile requires them.

## Lie

**Lie** is now executable through the PF2e system action. Its default profile is:

- Announcement: none;
- Roll: blind to the GM;
- Outcome: GM only.

The check uses Deception against the selected target's Perception DC, or a manual DC when no Actor target is available. The target model still supports multiple Lie targets, but dev.5 deliberately executes only one at a time. Full shared-roll/multi-DC resolution is reserved for the later multi-target block rather than approximating the rule incorrectly.

## Recall Knowledge

**Recall Knowledge** now asks the acting user which skill is being used. Action Forge offers the standard PF2e knowledge skills supported by the system action plus every Lore skill prepared on the Actor.

With an NPC target and an eligible standard identification skill, Action Forge leaves the DC to PF2e so the system can use its hidden identification DC without exposing the number to the player. If the selected skill is a Lore skill, the target is not an NPC, or the selected standard skill is not one PF2e identifies as appropriate for that creature, Action Forge starts the **GM DC Handoff** instead. The player requests the check, the action context is frozen, and one active GM receives a small DC dialog. The check is executed only after that GM supplies a valid DC. Players never receive a DC input field in Action Forge.

Its default profile is:

- Announcement: player and GM;
- Roll: blind to the GM;
- Outcome: GM only.

After a player completes the check, Action Forge only reports that the secret check was sent to the GM. It does **not** show the die total or degree of success in the local summary. A GM can still see the detailed local result.

## Manual test

1. Enable the module in a PF2e world and open Action Forge from the Token Controls hammer button.
2. Select an action with target and DC controls (for example Tumble Through) and confirm a vertical scrollbar appears when the workspace exceeds the window height; scroll down to the Roll button and action catalog.
3. Resize the Action Forge smaller and larger and confirm all workspace sections remain reachable.
4. Confirm Tumble Through and Climb still work as in dev.4.
5. As a player, select **Lie**, choose one target, and roll. Confirm the PF2e result is blind and Action Forge shows only **Secret check sent to the GM**, without total or degree of success.
6. Repeat Lie as GM and confirm the GM can see the result.
7. Select multiple Lie targets. Confirm the Roll button is disabled with a clear MVP single-target notice.
8. Select **Recall Knowledge**. Confirm a skill selector appears and contains Arcana/Crafting/Medicine/Nature/Occultism/Religion/Society plus any Lore skills on the acting Actor.
9. With no skill selected, confirm Roll remains disabled.
10. Select an NPC target and a suitable standard skill such as Nature. Confirm the DC panel states that PF2e will determine the target DC and does not reveal a numeric DC.
11. Roll as a player. Confirm the restricted action announcement is visible only to that player and active GMs, while the check/result remains blind to the GM.
12. Select a Lore skill as a player. Confirm the button changes to **Request DC from GM** and no manual DC field is shown.
13. Request the check. Confirm the player UI changes to **Waiting for GM**, while the acting Actor, target controls, and statistic selector remain frozen.
14. Confirm exactly one active GM receives a small DC dialog showing the requested action context. Enter a DC and confirm the blind PF2e check is executed only after submitting it.
15. Repeat and close/cancel the selected action while the GM dialog is still open. Confirm a later GM response does not trigger a roll.
16. As GM, confirm the same GM-defined case requires manual DC entry before rolling.
17. Confirm an automatically resolvable Recall Knowledge target DC does not trigger the handoff.
18. Confirm Climb and no-target Tumble Through still allow their explicitly manual/fallback DC entry for players.
19. Confirm source-Actor lock, target drag-and-drop, search, favorites, and current-token automatic mode still work.

## Automated checks

```bash
npm test
npm run check
```

The next planned block is **0.1.0-dev.6 – Application Engine & GM Broker**.
