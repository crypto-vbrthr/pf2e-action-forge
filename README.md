# PF2E Action Forge

Development build **0.1.0-dev.1.1 – Foundation & Application Shell Hotfix**.

This first block intentionally contains no real Pathfinder action rolls yet. It establishes the shell that later blocks build upon:

- Foundry VTT v14 / PF2e 8.4.0+ manifest;
- English and German localization;
- Foundry v14 Token SceneControl entry for GM and players, including the required tool order;
- `ApplicationV2` + Handlebars application shell;
- acting-Actor resolution and manual in-window selection;
- internal action registry;
- one harmless development action proving registry → UI → actor resolution wiring;
- fully module-scoped base CSS.

## Actor resolution

The current actor is resolved in this order:

1. a valid actor explicitly selected inside Action Forge;
2. exactly one controlled creature token;
3. the current user's assigned character;
4. the first permitted creature actor, preferring characters.

Players only receive creature actors they own. GMs may select any creature actor.

## Manual test

1. Enable the module in a PF2e world.
2. Log in as GM, activate the **Token Controls** (person/token icon on the left), and click the **hammer** tool for **Action Forge**.
3. Confirm the acting actor matches the controlled token or assigned character.
4. Change the actor from the selector and confirm the header refreshes.
5. Click **Foundation Check** and confirm the localized notification names the selected actor.
6. Repeat as a player. Confirm actors not owned by that player do not appear in the selector.
7. Change the controlled token while the window is open and confirm the application refreshes.

## Automated checks

```bash
npm test
npm run check
```

The next planned block is **0.1.0-dev.2 – Action Catalog & Favorites**.
