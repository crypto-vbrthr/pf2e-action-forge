# PF2E Action Forge

Development build **0.1.0-dev.2.1 – Action Catalog & Favorites UI Hotfix**.

This hotfix keeps the dev.2 catalog feature set and corrects Action Card layout under Foundry v14. Action buttons now expand to the height of wrapped titles and descriptions instead of inheriting Foundry's compact control-button height.

The underlying dev.2 block adds the permanent catalog surface for the first MVP actions. The actions are intentionally **not rolled yet**. Their cards, categories, search metadata, and personal favorite state are now in place so the later target/DC/roll blocks can attach behavior without redesigning the UI.

## Included in dev.2

- Foundry VTT v14 / PF2e 8.4.0+ module foundation;
- German and English localization;
- Token SceneControl launcher for GM and players;
- `ApplicationV2` + Handlebars application;
- acting-Actor resolver with **Current token (automatic)** and manual pinning;
- player access to owned characters/companions plus PF2e familiars whose master is owned;
- declarative Action Registry with ordering, categories, icons, and search keywords;
- initial eight-action MVP catalog:
  - Recall Knowledge;
  - Tumble Through;
  - Grapple;
  - Trip;
  - Climb;
  - Lie;
  - Demoralize;
  - Treat Wounds;
- localized skill/category grouping;
- live search across action names, descriptions, categories, and keywords;
- personal favorites saved on the current Foundry User document;
- dedicated Favorites section at the top of the catalog;
- star toggles directly on every Action Card;
- release metadata, `CHANGELOG.md`, and MIT `LICENSE`.

## Favorites

Favorites are stored with a user flag under the module namespace. They are therefore personal to each Foundry user and persist across closing the Action Forge, reloads, and later sessions. Favoriting an action does not require an acting Actor to be selected.

## Search

Search filters the already-rendered catalog in place rather than re-rendering the application on each keystroke. This keeps keyboard focus stable while typing. It searches localized action/category text together with internal action keywords.

## Actor resolution

The actor selector has two behaviors:

1. **Current token (automatic)** follows exactly one controlled creature token. If there is no unambiguous controlled token, the user's assigned character and then another permitted actor are used as fallback.
2. Choosing a named actor pins that actor while the Action Forge window remains open, even if token control changes.

Closing and reopening Action Forge resets the selector to **Current token (automatic)**.

Players may select creature actors to which they have **OWNER** permission. PF2e familiars are additionally allowed when their configured master is owned by the player. GMs may select any creature actor.

## Manual test

1. Enable the module in a PF2e world and open Action Forge from the Token Controls hammer button.
2. Confirm the eight MVP action cards appear grouped under General Skill Actions, Acrobatics, Athletics, Deception, Intimidation, and Medicine.
3. Search for an action name, a skill name, and a keyword-like term such as `Reflex`. Confirm irrelevant cards and empty categories disappear without the search field losing focus.
4. Star two or more actions. Confirm they immediately appear in the Favorites section.
5. Close and reopen Action Forge. Confirm the favorites remain.
6. Reload Foundry and confirm the same user's favorites remain.
7. Log in as a different player and confirm that player's favorites can differ.
8. Remove a favorite from either its normal category card or Favorites card and confirm both views update.
9. Confirm the acting-Actor automatic/manual selector behavior from dev.1 remains unchanged.
10. Clicking an action currently produces only a localized development notification; real PF2e rolls intentionally begin in later blocks.

## Automated checks

```bash
npm test
npm run check
```

The next planned block is **0.1.0-dev.3 – Targets & Drag-and-Drop**.
