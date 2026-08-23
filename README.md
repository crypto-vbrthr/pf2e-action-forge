# PF2E Action Forge

Development build **0.1.0-dev.7.7 – Treat Wounds Public Summary**.

This hotfix replaces the player-to-GM application request transport with Foundry v14's native `User.query` mechanism. Healing, Wounded removal, immunity, damage, and other privileged result applications now use a direct request/response query to the active GM instead of waiting on a hand-built socket response.

## Included through dev.7.4

- all foundation, catalog, targeting, DC, Visibility Profiles, GM DC Handoff, Application Engine, and Treat Wounds features from dev.1–dev.7;
- successful Treat Wounds healing now posts a public summary naming healer and target, actual HP restored, success/critical-success degree, and temporary immunity duration;
- a new **Choose Target…** button in the active action target panel;
- a GM-built, sanitized out-of-combat target directory;
- grouped choices for **your characters & companions**, **party**, **player characters**, **current scene**, and **other visible Actors**;
- active PF2e Party members can be selected without ownership permission;
- characters assigned to other players can be selected without ownership permission;
- picker targets work even when the player's client cannot resolve the underlying Actor document locally;
- hidden/unrelated GM Actors are not disclosed;
- picker-selected Actors are revalidated by the GM Broker before any privileged application is written;
- Treat Wounds immunity is checked while building the target list so an immune target cannot bypass the normal 60-minute lockout by using the picker;
- token targeting and sidebar drag-and-drop remain available unchanged;
- German and English localization;
- release metadata, `CHANGELOG.md`, and MIT `LICENSE`.

## Out-of-combat target security model

The player does not receive a copy of another Actor's statistics. The GM sends only safe display metadata: Actor UUID, name, image, type, target category, and whether the Actor is currently unavailable for the selected action. HP, defenses, conditions, notes, hidden fields, and other document data stay on the GM side.

When an application is later requested, the GM Broker resolves the Actor by UUID and independently checks that the player was legitimately allowed to select that Actor through party membership, player-character assignment, ownership, a visible scene token, or ordinary Foundry visibility. This keeps out-of-combat selection useful without turning Action Forge into an Actor-directory information leak.

## Manual test

1. Enable the module in a PF2e world with one GM and at least two player characters connected or configured.
2. Ensure Player A does **not** have ownership of Player B's character. The character may have no token on the active scene.
3. As Player A, select **Treat Wounds**.
4. Click **Choose Target…** and confirm Player B's character appears under Party or Player Characters.
5. Select that character and confirm it appears as the Action Forge target even though Player A cannot normally drag it from the Actor sidebar.
6. Roll Treat Wounds and apply healing / Remove Wounded. Confirm the GM Broker modifies Player B's Actor successfully.
7. Confirm the 60-minute Treat Wounds immunity is automatically applied.
8. Start Treat Wounds again, reopen **Choose Target…**, and confirm the immune Actor is unavailable.
9. Confirm unrelated hidden NPC Actors do not appear in the target picker.
10. Repeat with an owned companion, a Party Actor member, and a visible scene NPC.
11. Confirm native token targeting and sidebar drag-and-drop still work.
12. Confirm Grapple, Trip, Tumble Through, Climb, Lie, Recall Knowledge, GM DC Handoff, favorites, and source-Actor locking still work.

## Automated checks

```bash
npm test
npm run check
```

The next planned block is **0.1.0-dev.8 – Demoralize & Timed Results**.


### Out-of-combat target picker reliability
The target picker resolves safe party, assigned-character, owned, and visible-scene targets locally first. A GM-side sanitized directory is now only a fallback for unusual permission setups.
