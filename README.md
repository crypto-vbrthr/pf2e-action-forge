# PF2E Action Forge

Development build **0.1.0-dev.1.4 – Foundation & Release Metadata**.

This first block intentionally contains no real Pathfinder action rolls yet. It establishes the shell that later blocks build upon:

- Foundry VTT v14 / PF2e 8.4.0+ manifest;
- English and German localization;
- Foundry v14 Token SceneControl entry for GM and players;
- `ApplicationV2` + Handlebars application shell;
- acting-Actor resolution with an explicit **Current token (automatic)** selector mode;
- manual actor pinning while the window remains open;
- player access to owned character/companion actors and PF2e familiars whose configured master is owned;
- internal action registry;
- one harmless development action proving registry → UI → actor resolution wiring;
- fully module-scoped base CSS;
- release-ready repository metadata plus `CHANGELOG.md` and MIT `LICENSE`.

## Actor resolution

The actor selector now has two behaviors:

1. **Current token (automatic)** follows exactly one controlled creature token. If there is no unambiguous controlled token, the user's assigned character and then another permitted actor are used as fallback.
2. Choosing a named actor pins that actor while the Action Forge window remains open, even if token control changes.

Closing and reopening Action Forge resets the selector to **Current token (automatic)** so an old manual choice cannot unexpectedly carry into a later use.

Players may select creature actors to which they have **OWNER** permission. This naturally includes animal companions, construct companions, and eidolons built as separate PC actors when their ownership is assigned to that player. PF2e familiars are additionally allowed when their configured master is owned by the player, even if the familiar itself still has PF2e's default LIMITED ownership.

GMs may select any creature actor.

## Manual test

1. Enable the module in a PF2e world.
2. Open Action Forge from the Token Controls hammer button.
3. Leave the selector on **Current token (automatic)** and switch between controlled tokens. Confirm the acting actor follows the token.
4. Select a named actor from the selector and switch tokens. Confirm the explicitly selected actor remains pinned while the window is open.
5. Close and reopen Action Forge. Confirm **Current token (automatic)** is selected again.
6. As GM, control an unlinked NPC token and confirm the synthetic NPC becomes the acting actor.
7. As a player, confirm owned companion/PC actors appear. Confirm unrelated actors do not appear.
8. If the player has a PF2e familiar with an owned master, confirm the familiar appears even when the familiar actor itself was not manually raised to OWNER.
9. Click **Foundation Check** and confirm the localized notification names the active actor.

## Automated checks

```bash
npm test
npm run check
```

The next planned block is **0.1.0-dev.2 – Action Catalog & Favorites**.
