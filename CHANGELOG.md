# Changelog

All notable changes to **PF2E Action Forge** will be documented in this file.

The project is currently in early development. Version entries follow the module's development-build numbering until a stable release line is established.

## [0.1.0-dev.5.3] - 2026-08-23

### Added

- Added a **GM DC Handoff** for secret checks whose DC cannot be determined automatically.
- A player can now request a secret DC from one deterministic active GM; the roll does not begin until the GM supplies a valid DC.
- Added a remote GM input dialog showing the action, acting character, target, and selected statistic without exposing the chosen DC in the player's Action Forge UI.
- Added waiting-state UI and a dedicated **Request DC from GM** action state.
- Added deterministic active-GM selection to avoid duplicate requests when multiple GMs are connected.

### Changed

- Recall Knowledge with a GM-defined DC now pauses instead of rolling with an undefined DC.
- While a GM DC request is pending, the acting Actor, action, target controls, and statistic selection remain frozen.
- Cancelling the selected action or closing Action Forge invalidates the pending request so a late GM response cannot trigger a roll.
- When the GM performs the same GM-defined check directly, a manual DC is now required unless PF2e can determine the hidden target DC automatically.

### Security / Information Hardening

- Players still cannot enter or override GM-defined DCs.
- A changed native canvas target during the waiting period cannot alter the already-requested action context.

## [0.1.0-dev.5.2] - 2026-08-23

### Fixed

- Players can no longer enter or override **GM-defined / secret DCs** such as Recall Knowledge adjudication.
- Manual DC input for `gm-defined` checks is now available only to the GM and the resolver ignores player-supplied values even if injected outside the normal UI.
- Automatic PF2e target DC resolution remains available to players without revealing the numeric DC.
- Player-editable manual DCs remain available only where the action itself explicitly requires a manual/environmental DC or a no-target fallback.

### Security / Information Hardening

- Secret DC ownership is enforced in the DC Resolver rather than being only a template-level restriction, preventing a modified player client from changing the hidden DC through Action Forge state.

## [0.1.0-dev.5.1] - 2026-08-23

### Fixed

- Added a dedicated vertical scrollbar for the complete Action Forge workspace whenever the selected action makes the window content taller than the current window.
- Reworked the catalog container to use the single outer workspace scroll area, avoiding clipped target/DC/visibility/roll controls and nested scrolling.
- Reserved scrollbar space to reduce layout shifts when the scrollbar appears.

## [0.1.0-dev.5] - 2026-08-23

### Added

- Added declarative visibility profiles with separate `announcement`, `roll`, and `outcome` channels.
- Added localized visibility-profile display to the active action workspace.
- Added **Lie** as a real PF2e secret check against a target's Perception DC, with manual-DC fallback.
- Added **Recall Knowledge** as a real PF2e secret check with selectable Arcana, Crafting, Medicine, Nature, Occultism, Religion, Society, and Actor Lore skills.
- Added PF2e target-DC delegation for Recall Knowledge when a standard identification skill and NPC target allow the PF2e system to determine the hidden DC.
- Added optional manual GM/DC entry for Recall Knowledge while allowing blind checks with a GM-adjudicated hidden DC when PF2e cannot safely determine one, including Lore-based checks.
- Added restricted player+GM action announcements for Recall Knowledge while keeping the mechanical roll blind.
- Added a Visibility Engine for secret-roll traits, local-result redaction, and visibility-aware recipient resolution.
- Added regression coverage for secret-roll enforcement, hidden local summaries, Recall Knowledge DC fallback, and visibility metadata.

### Security / Information Hardening

- Secret Action Forge checks no longer expose their local roll total or degree of success to a non-GM user after the PF2e roll completes.
- Blind/GM-only roll profiles enforce PF2e's `secret` trait when the underlying system action does not already provide it.
- Lie and Recall Knowledge keep their outcome restricted to the GM by default.

### Notes

- The current MVP execution of **Lie** resolves one target at a time. Multi-target selection remains available in the target model and will receive full shared-roll/multi-DC handling in the later multi-target block.

## [0.1.0-dev.4.2] - 2026-08-23

### Added

- Added an action-session source-Actor lock: selecting an action freezes the acting Actor until that action is completed or cancelled.
- Added a visible lock badge and disabled source-Actor selector while an action session is active.
- Preserved the last PF2e roll summary after the action workspace closes.

### Fixed

- Changing token control while selecting or changing an action target can no longer silently replace the acting Actor mid-action.
- Automatic current-token mode resumes after the action completes or is cancelled, while an explicitly pinned Actor remains explicitly selected.

## [0.1.0-dev.4.1] - 2026-08-23

### Fixed

- Fixed sidebar Actor targets not being authoritative for target-defense checks when a different token was still targeted on the canvas.
- Fixed target-defense checks with only a dragged sidebar Actor sometimes failing to resolve any DC.
- Sidebar drops for single/optional target actions now release stale native canvas targets so PF2e cannot silently reuse the wrong creature.
- Actor-only target defenses now resolve to the Actor's prepared PF2e DC while retaining the Actor as explicit roll target.

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
