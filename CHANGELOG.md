# Changelog

All notable changes to **PF2E Action Forge** will be documented in this file.

The project is currently in early development. Version entries follow the module's development-build numbering until a stable release line is established.

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
