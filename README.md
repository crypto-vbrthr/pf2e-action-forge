# PF2E Action Forge

Development build **0.1.0-dev.6 – Application Engine & GM Broker**.

This build adds the first safe mechanical-result layer. Players can execute supported PF2e actions against targets they do not own, and an active GM client can apply the approved result without granting the player write permission to the target Actor.

## Included in dev.6

- all foundation, catalog, targeting, DC, **Visibility Profiles**, and GM DC Handoff features from dev.1–dev.5;
- declarative Application Engine with an allow-listed effect schema;
- GM-mediated application broker using the module socket;
- unique Action Transaction IDs and duplicate-application protection;
- application state stored on dedicated Action Forge chat cards;
- permission-aware Apply buttons;
- real PF2e **Grapple** and **Trip** execution;
- **Grabbed**, **Restrained**, and **Prone** application through PF2e condition items;
- application works for a player's own target as well as an Actor owned by another player or the GM;
- condition applications store Action Forge source/transaction flags for later lifecycle handling;
- German and English localization;
- release metadata, `CHANGELOG.md`, and MIT `LICENSE`.

## Application security model

The player never sends an arbitrary Actor update to the GM. A chat transaction records the action, source, target, and outcome. When Apply is clicked, the broker independently resolves the registered action and the exact allow-listed effect for that outcome, validates the source Actor permission and target, and only then performs the PF2e document change. Repeated requests for the same transaction/effect are ignored.

## Current automated outcomes

- **Grapple**: Success → Grabbed; Critical Success → Restrained.
- **Trip**: Success/Critical Success → Prone.

The additional 1d6 bludgeoning damage from a critical-success Trip and the choice-driven critical-failure consequence of Grapple remain manual in dev.6. Those require the later damage/choice executors rather than a deliberately lossy shortcut.

## Manual test

1. Enable the module in a PF2e world with one GM and one player connected.
2. As a player, select an owned character, target a creature the player does **not** own, and execute **Grapple**.
3. On Success, confirm the Action Forge chat card offers **Apply Grabbed**. On Critical Success it should offer **Apply Restrained**.
4. Click the Apply button as the player. Confirm the target receives the PF2e condition even though the player has no write permission to the target.
5. Confirm the Apply button changes to **Applied** and a second click cannot create a duplicate condition.
6. Repeat with **Trip** and confirm Success/Critical Success offers **Apply Prone**.
7. Repeat against an Actor dragged from the sidebar and confirm the same broker path works.
8. Repeat as GM and confirm the application succeeds directly without requiring a second client.
9. Connect a second GM and confirm the result is still applied only once.
10. Confirm a player cannot use an application card created by another user's unrelated action source.
11. Confirm existing Tumble Through, Climb, Lie, Recall Knowledge, GM DC Handoff, favorites, targeting, and source-Actor locking still work.

## Automated checks

```bash
npm test
npm run check
```

The next planned block is **0.1.0-dev.7 – Treat Wounds Workflow**.
