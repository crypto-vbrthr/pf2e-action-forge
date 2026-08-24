# Changelog

## [0.1.0-dev.11.1] - 2026-08-24

### Changed

- Selecting an action now automatically scrolls the Action Forge workspace to the purple **Selected Action** execution block after it appears.
- The automatic jump is limited to deliberate action selection; ordinary rerenders continue to preserve the user's current scroll position and input focus from the dev.9 hardening work.
- Smooth scrolling is used by default and respects the operating system's reduced-motion preference.
- Added regression coverage for the one-shot post-selection scroll behavior.
- Automated suite now contains **96 passing tests**.

## [0.1.0-dev.11] - 2026-08-24

### Added

- Expanded the enabled catalog from **19 to 32 actions** with the Social & Exploration block.
- Added **Perform** for Performance.
- Added **Make an Impression**, **Request**, and secret **Gather Information** for Diplomacy.
- Added secret **Impersonate** for Deception and **Coerce** for Intimidation.
- Added secret **Conceal an Object**, **Hide**, and **Sneak** for Stealth.
- Added **Subsist**, secret **Sense Direction**, trained **Track**, and trained **Cover Tracks** for exploration and Survival workflows.
- Added an `activity` execution mode for activities that do not call for an immediate check; Cover Tracks is the first implementation.
- Added `system-or-statistic` execution so actions can prefer the PF2e system action and fall back to the Actor's prepared PF2e statistic when that action API is unavailable.
- Added direct-statistic defense resolution so fallback checks can use a selected Actor's prepared defense DC without relying on stale Canvas targets.
- Added target-defense `allowUnknown` support: secret observer checks use a readable target's Perception DC when available and otherwise enter the existing GM DC handoff without exposing a manual DC field to players.
- Added German and English localization for all new categories, actions, descriptions, and the no-roll activity execution label.
- Added regression coverage for the dev.11 catalog, social/secret DC models, statistic choice, proficiency gates, system-action fallback, hidden statistic rolls, observer-DC handoff, and no-roll activities.

### Changed

- Secret statistic fallback rolls now preserve hidden DC visibility and the PF2e `secret` trait.
- Track and Cover Tracks are explicitly gated to trained Survival.
- Cover Tracks announces the activity publicly but does not manufacture an immediate d20 check; pursuers remain responsible for their Track checks against the appropriate Survival DC.
- Automated suite now contains **95 passing tests**.

## [0.1.0-dev.10.1] - 2026-08-24

### Changed

- Visually separated the selected-action execution workflow from the warm/orange action catalog using a dedicated muted-purple accent.
- Wrapped target selection and DC/execution controls in one clearly bounded workflow container so the beginning and end of the active action are easier to scan.
- Matching purple accents now carry through the selected action icon, target controls, drop zone, DC source, and primary execution button while success/warning/error states retain their semantic colors.
- The catalog and favorites keep the existing warm accent, preserving a clear visual distinction between choosing an action and carrying it out.

## 0.1.0-dev.10 - Combat & Movement Actions

- Expanded the core Action Forge catalog from 8 to **19 enabled actions**.
- Added **Balance** and trained **Squeeze** for Acrobatics.
- Added **Shove**, **Reposition**, trained **Disarm**, **Force Open**, **Swim**, **High Jump**, and **Long Jump** for Athletics.
- Added **Create a Diversion** and trained **Feint** for Deception.
- Added the corresponding PF2e system-action slugs to the PF2e Action Adapter fallback map.
- Added target-defense DC mappings for Fortitude, Reflex, and Perception based actions.
- Added fixed DC handling for High Jump (30) and Long Jump (15), while environmental movement actions use the existing manual-DC workflow.
- Preserved PF2e as the authoritative roll engine for the new actions instead of duplicating action check logic in Action Forge.
- Kept forced movement and positional outcomes descriptive in this build rather than automatically moving tokens.
- Modeled Create a Diversion as multi-target-capable in target metadata while retaining one target per execution until per-target DC batching is implemented.
- Increased the default Action Forge window from 700 to **1120 px** wide and 820 px high.
- Changed skill action groups to a responsive multi-column grid that generally fits four cards side by side at the default desktop width, with narrow-window fallbacks.
- Added German and English localization for every new action and updated the development footer/version metadata.
- Added dev.10 regression coverage for the complete action set, DC/target models, proficiency gates, PF2e action resolution, and the wider responsive layout.
- Automated suite now contains **87 passing tests**.

## 0.1.0-dev.9 - UX & Player Hardening

- Added an explicit in-flight execution lock around PF2e checks. Double-clicking the roll button or changing targets while the PF2e roll pipeline is active can no longer start duplicate checks.
- Successful or cancelled PF2e roll sessions now always release the frozen source Actor and target state, even if later Action Forge chat/result processing throws. Failed roll startup remains selected for a clean retry.
- Preserved the Action Forge outer scroll position, focused control, and text selection across rerenders so searches and long action workspaces no longer jump unexpectedly.
- Added `aria-busy` state and clearer localized UI feedback while a check is being processed.
- Hardened Canvas targeting: hidden tokens are ignored for non-GM users, and application requests from stale/deleted or hidden token UUIDs are rejected by the GM Broker.
- Hardened secret outcomes: player clients do not create application cards for GM-only or blind outcomes.
- Hardened privileged applications and the out-of-combat target directory around Foundry v14 `User.query`: the active GM is preferred and requests can fail over to another active GM if the broker disconnects. Raw module sockets remain only as a compatibility fallback.
- Hardened GM DC handoff for multiple GMs. Transport failure may fail over to another GM, while an intentional rejection/close is final and is never forwarded to a second GM.
- Coalesced duplicate ChatMessage application clicks for the same transaction/effect onto one broker request, protecting against duplicate rendered chat views and rapid repeated clicks.
- Added immediate, specific errors for deleted source/target Actors and broker disconnects instead of allowing ambiguous timeouts.
- Added a dedicated hardening regression suite covering hidden targets, stale tokens, multi-GM failover, secret outcomes, duplicate execution, UI-state preservation, and duplicate application requests.

## 0.1.0-dev.8 - Demoralize & Timed Results

- Enabled **Demoralize** as a live PF2e system action using Intimidation against the target's Will DC.
- Added confirmable result applications: Critical Success can apply **Frightened 2** and Success can apply **Frightened 1**.
- Added valued-condition support to the Application Engine. Applying Frightened now raises an existing lower value when needed and never reduces a higher existing value.
- Added the rules-mandated **10-minute Demoralize immunity** on every degree of success. The immunity is applied automatically and is **source-specific**, so only the same acting character is blocked from Demoralizing that target again during the window.
- Demoralize immunity uses Foundry world time and becomes eligible again automatically after 10 minutes.
- The target picker and execution controls respect source-specific Demoralize immunity before a new roll is made.
- Replaced the Treat-Wounds-specific blocked-action warning with a generic action-immunity warning usable by timed results across the Action Forge.
- Added German and English labels for Demoralize result applications and immunity effects.

## 0.1.0-dev.7.7 - Treat Wounds Public Summary

- Added a public chat summary after successful Treat Wounds healing is applied and the standard immunity is active.
- The summary names the healer and target, shows Success or Critical Success, reports the actual HP restored, and states the Treat Wounds immunity duration.
- Healing application now records both the rolled healing amount and the actual HP restored, so overhealing is reported accurately.
- Immunity duration text is derived from the configured effect duration instead of hard-coding one hour, preparing the summary for later feat-aware duration changes such as Continual Recovery.
- Added duplicate-summary protection tied to the Action Transaction.

## 0.1.0-dev.7.6 - Foundry Query Broker Hotfix

- Replaced the primary player-to-GM application transport with Foundry v14 `User.query` / `CONFIG.queries`.
- Privileged healing, Wounded removal, immunity, damage, and condition applications now receive their response through Foundry's native targeted query mechanism instead of a custom two-message socket handshake.
- Registered the prefixed `pf2e-action-forge.applyActionResult` query during module initialization on every client.
- Prefer Foundry's `game.users.activeGM` when selecting the privileged application broker, with the previous deterministic active-GM selection retained as fallback.
- Kept the legacy raw module-socket broker only as a compatibility fallback for unusual environments without `User#query`.
- Added regression coverage for query registration and player-to-GM query application.

## 0.1.0-dev.7.5 - Picker Application Broker Hotfix

- Fixed GM-side validation of out-of-combat picker targets when the PF2e party member collection is not a plain Array.
- Player-triggered healing, condition removal, and immunity application can now be brokered to the GM for picker-selected characters without timing out.
- Hardened the application socket broker so unexpected GM-side validation/API errors always return an explicit response instead of leaving the player waiting for the timeout.
- Added regression coverage for picker-selected party/assigned-character targets and broker error responses.


## 0.1.0-dev.7.4 - Application Button Reliability Hotfix

- Fixed Treat Wounds and other application-card buttons not reacting in some Foundry v14 chat render paths.
- Application buttons now bind directly to their rendered ChatMessage while retaining delegated click handling as a fallback.
- Added short replication retries when a player applies a result before the GM client has received the freshly-created transaction message.
- Added a dedicated synchronization warning instead of silently failing when a transaction is not yet available.

## [0.1.0-dev.7.3] - 2026-08-23

### Fixed
- Treat Wounds no longer requires a `game.pf2e.actions` system-action entry. Current PF2e exposes Treat Wounds as compendium/macro content rather than the same `SingleCheckAction` API used by actions such as Trip and Tumble Through.
- Added a direct PF2e Statistic execution path for actions whose check is fully described by an Actor statistic and a resolved DC. Treat Wounds now rolls the Actor's prepared Medicine statistic, preserving PF2e modifiers, rule elements, roll options, check dialog behavior, and degree-of-success calculation.
- UUID-only out-of-combat picker targets no longer prevent the fixed-DC Medicine check: the target is retained by Action Forge for result application while the roll itself only requires the healer and selected treatment DC.

### Hardening
- Action definitions now declare an execution mode (`system-action` or `statistic`) instead of assuming every supported action must exist in `game.pf2e.actions`.
- Added regression tests for direct-statistic execution and remote picker targets.

## [0.1.0-dev.7.2] - 2026-08-23

### Fixed
- The out-of-combat target picker now builds its safe target directory locally first, so normal party healing no longer waits for a GM socket round-trip.
- Assigned player characters, PF2e party members, and visible scene actors are included even when they are not present in the local `game.actors` collection.
- GM directory fallback requests now return explicit failures instead of silently timing out when target enumeration throws.
- Read-only target directory fallback may be answered by any active GM; the first valid response wins.

All notable changes to **PF2E Action Forge** will be documented in this file.

The project is currently in early development. Version entries follow the module's development-build numbering until a stable release line is established.

## [0.1.0-dev.7.1] - 2026-08-23

### Added

- Added an **out-of-combat target picker** for actions that need an Actor target without relying on combat targeting or Actor ownership.
- Added a **Choose Target…** control alongside native token targeting and sidebar drag-and-drop.
- The GM builds a sanitized target directory containing only UUID, name, image, type, category, and action-availability metadata.
- Party members from the active PF2e Party Actor and characters assigned to non-GM users can be selected even when the acting player has no ownership permission on them.
- Owned characters/companions, non-hidden Actors on the player's viewed scene, and other Actors with at least Limited visibility are also offered in grouped target choices.
- Picker-selected targets can remain valid even when the requesting client cannot resolve the Actor document locally; privileged applications continue through the GM Broker by UUID.

### Security / Hardening

- Unrelated hidden GM Actors are never included in the player's target directory.
- Picker targets are revalidated by the GM Broker at application time using the same party/assigned/owned/scene/visibility rules; a player cannot forge an arbitrary hidden Actor UUID into an application request.
- Action-specific blocking immunity is checked by the GM while building the safe target list. Treat Wounds targets with active Action Forge immunity are shown as unavailable rather than becoming a bypass around the 60-minute lockout.
- The picker transfers no target defenses, HP values, conditions, notes, or other hidden Actor data to the player.

### Changed

- Result application cards can now be created for UUID-only picker targets, enabling the complete Treat Wounds workflow against another player's character outside combat.
- Target hints and source labels now describe token targeting, Action Forge target selection, and sidebar drag-and-drop as parallel input methods.

## [0.1.0-dev.7] - 2026-08-23

### Added

- Added the complete first **Treat Wounds** workflow using the PF2e system action and Medicine statistic.
- Added proficiency-aware treatment DC choices: DC 15 (Trained), DC 20 (Expert), DC 30 (Master), and DC 40 (Legendary).
- Added DC-dependent healing formulas: 2d8/4d8 plus the +10/+30/+50 higher-DC bonuses.
- Added application support for healing, damage, condition removal, and timed Action Forge immunities.
- Treat Wounds success and critical success can remove **Wounded**; critical failure can apply 1d8 damage.
- Added a real PF2e Effect for the standard **60-minute Treat Wounds immunity**, tracked against Foundry world time.
- The Treat Wounds immunity is applied automatically after the completed check; its chat button remains as a fallback if the privileged write cannot complete.
- Added active-immunity detection so a target cannot be treated again through Action Forge while the standard immunity is still active.
- Healing, damage, Wounded removal, and immunity can be applied to Actors the acting player does not own through the existing validated GM Broker.

### Hardening

- Treat Wounds outcome formulas are re-resolved from the GM-side Action Registry and the recorded transaction DC; players cannot submit arbitrary healing or damage formulas.
- Higher treatment DCs are filtered by the acting Actor's actual Medicine proficiency rank.
- Timed immunity records carry action, source, transaction, duration, and world-time expiry metadata for later feat-aware duration handling.
- Added per-effect application modes so intrinsically automatic consequences can coexist with confirmable result buttons.

### Notes

- dev.7 implements the standard 10-minute Treat Wounds activity and its normal 1-hour immunity. Talent-specific modifications such as **Continual Recovery / Anhaltende Genesung**, Ward Medic, Natural Medicine, and 1-hour extended treatment are reserved for later feat/variant blocks.

## [0.1.0-dev.6] - 2026-08-23

### Added

- Added the first **Application Engine** with an allow-listed declarative result schema instead of arbitrary client-supplied Actor updates.
- Added a GM-mediated **Application Broker** over the module socket for applying results to Actors a player does not own.
- Added Action Transactions with unique IDs and chat-message flags for duplicate-application protection.
- Added result-application chat cards with permission-aware buttons and applied-state feedback.
- Enabled real PF2e **Grapple** and **Trip** checks.
- Grapple can apply **Grabbed** on success and **Restrained** on critical success.
- Trip can apply **Prone** on success and critical success.
- Condition items created by Action Forge carry source/transaction flags for later source-aware cleanup and auditing.

### Security / Hardening

- Players never send arbitrary Actor update payloads to the GM broker. The broker re-resolves the action and requested effect from its own Action Registry.
- The broker validates the requesting user, source Actor permissions, target legitimacy, action/outcome/effect identity, and transaction state before writing to the target.
- Application requests are idempotent: repeated clicks or duplicate socket delivery cannot apply the same effect twice.
- One deterministic active GM acts as broker when players lack write permission on the target.

### Notes

- dev.6 intentionally automates the unambiguous condition consequences of Grapple and Trip first. Trip's critical-success 1d6 bludgeoning damage and the choice-driven consequences of Grapple critical failure remain manual until their dedicated damage/choice application support is added.

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
