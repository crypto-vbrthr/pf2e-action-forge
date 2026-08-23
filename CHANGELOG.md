# Changelog

All notable changes to **PF2E Action Forge** will be documented in this file.

The project is currently in early development. Version entries follow the module's development-build numbering until a stable release line is established.

## [0.1.0-dev.4] - 2026-08-23

### Added

- Added a declarative DC Resolver with manual, target-defense, fixed, fixed-choice, and GM-defined strategies.
- Added defense metadata for the full eight-action MVP catalog.
- Added a PF2e Action Adapter that delegates checks to the installed PF2e system action implementation.
- Enabled the first real Action Forge checks for **Tumble Through** and **Climb**.
- Added automatic target-defense resolution for Tumble Through using the selected target's Reflex DC.
- Added manual DC fallback for Tumble Through when no target is selected.
- Added manual environmental DC entry for Climb.
- Added a compact DC/check panel with readiness feedback and last-result display.
- Added automated coverage for DC resolution, PF2e action delegation, catalog execution metadata, and the dev.4 UI.

### Changed

- Single-target MVP actions that support a manual DC fallback can now remain valid without a selected Actor target.
- The Action Forge now distinguishes target validity from DC validity so targetless Theater-of-the-Mind checks can use manually supplied DCs.

## [0.1.0-dev.3] - 2026-08-23

### Added

- Added declarative `none`, `optional`, `single`, and `multiple` target modes to Action Registry definitions.
- Added target metadata for all eight MVP actions.
- Added a dedicated Target Resolver for Foundry canvas targets and sidebar Actor drag-and-drop.
- Added live target refresh through the current user's `targetToken` events.
- Added target chips with source labels and removal controls.
- Added sidebar Actor drop handling with creature/visibility validation.
- Added combination and deduplication of canvas and sidebar targets for multi-target actions.
- Added selected-action target workspace and target requirement/status UI.
- Added tests for target metadata, target resolution, target deduplication, and release metadata.

### Changed

- Clicking an action now selects it and opens its target workflow instead of showing the earlier development notification.
- Action Cards now display their target mode.
- Increased the default Action Forge height slightly to accommodate the target workspace.

## [0.1.0-dev.2.1] - 2026-08-23

### Fixed

- Fixed Action Card content being vertically clipped by Foundry v14 button sizing rules.
- Action buttons now grow with wrapped titles/descriptions and explicitly override inherited fixed button height, line height, white-space, and overflow behavior.

## [0.1.0-dev.2] - 2026-08-23

### Added

- Added the initial eight-action MVP catalog with localized skill/category grouping.
- Added Action Registry ordering, category metadata, category icons, and search keywords.
- Added live in-place catalog search across localized action text, categories, and keywords.
- Added per-user favorites stored as Foundry User flags.
- Added a Favorites section and star toggles to all Action Cards.
- Added a small read-only action-list API for future integration work.
- Added automated coverage for the catalog, favorite persistence, and dev.2 release metadata.

### Changed

- Replaced the Foundation Check dummy action with the real MVP catalog surface.
- Increased the default Action Forge window size to make grouped actions easier to browse.
- Updated README/manual testing for catalog and favorites behavior.

## [0.1.0-dev.1.4] - 2026-08-23

### Added

- Added this `CHANGELOG.md` for release history.
- Added an MIT `LICENSE` file.
- Added repository, manifest, and release-download metadata to `module.json` in preparation for a future Foundry VTT package listing.
- Added automated checks for release metadata and required repository files.

## [0.1.0-dev.1.3] - 2026-08-23

### Added

- Added **Current token (automatic)** as the default acting-Actor selection mode.
- Added manual Actor pinning for the lifetime of the open Action Forge window.
- Added player selection of owned companion Actors.
- Added PF2e familiar selection when the familiar's configured master is owned by the player.

### Changed

- Reopening Action Forge now resets acting-Actor selection to the automatic current-token mode.

## [0.1.0-dev.1.2] - 2026-08-23

### Fixed

- Fixed acting-Actor resolution for controlled unlinked NPC tokens whose synthetic Actors are not present in `game.actors`.

## [0.1.0-dev.1.1] - 2026-08-23

### Fixed

- Fixed Foundry VTT v14 Token Scene Control registration so the Action Forge button appears correctly in the Token Controls tool palette.

## [0.1.0-dev.1] - 2026-08-23

### Added

- Initial Foundry VTT v14 / PF2e module foundation.
- German and English localization.
- `ApplicationV2` + Handlebars application shell.
- Initial acting-Actor resolver.
- Token Scene Control launcher.
- Internal Action Registry.
- Foundation Check development action.
- Module-scoped base styling and automated foundation tests.
