## 0.1.0-rc.3 – Critical Forge Shared-Roll Integration

### Added

- Added optional integration with PF2E Critical Forge's public critical-card automation API for Action Forge shared rolls.
- Shared-roll actions now feed their GM-resolved critical skill outcomes back into Critical Forge after the one PF2e check has been compared against all selected observers.
- One shared check can produce at most one Critical Forge event for critical success and at most one for critical failure, preventing a multi-target roll from drawing one card per observer.
- When both extremes occur on the same check, Critical Forge may independently process one skill critical-success event and one skill critical-failure event.
- The first target in each critical outcome group is supplied as the representative target; the full number of targets in that critical group is preserved in Critical Forge's runtime snapshot through `targetTokens` when token documents are available.
- The bridge is fully optional and does nothing when Critical Forge is absent, disabled, lacks the `skillCheckCriticals` capability, or has the corresponding skill critical trigger disabled.

### Changed

- Shared-roll completion does not wait for optional Critical Forge prompts/card publication, so a player's Action Forge workflow remains responsive while the GM handles Critical Forge.
- Synchronized release metadata and runtime fallbacks to `0.1.0-rc.3`.

### Tests

- Added regression coverage for critical-group collapsing, optional-module behavior, explicit skill context, target-count propagation, and success/failure dual-category processing.
- Full automated suite and JavaScript syntax checks pass.

## 0.1.0-rc.2 – Foundry v14 Chat Hook Compatibility Cleanup

### Fixed

- Removed the deprecated `renderChatMessage` hook registrations from both application-result chat decoration and the internal GM-DC transport-message hider.
- Action Forge now uses only Foundry v14's `renderChatMessageHTML` hook for chat-message DOM work, avoiding the compatibility warning that the legacy hook is deprecated since Foundry v13 and scheduled for removal in v15.
- Kept the existing HTMLElement-first handlers unchanged; they already support the `renderChatMessageHTML` DOM argument used by Foundry v14.
- Synchronized module/package/runtime release metadata to `0.1.0-rc.2`.

### Tests

- Added release-candidate compatibility coverage that fails if any shipped script registers the deprecated `renderChatMessage` hook.
- Full automated suite and JavaScript syntax checks pass.

## 0.1.0-rc.1 – Release Candidate & Final Integration Review

### Fixed

- Completed the release-candidate integration pass across the full 65-card catalog, ActionRegistry normalization, GM authority, visibility, target brokering, shared rolls, prerequisites, application writes, exploration persistence, localization, diagnostics, and release metadata.
- Closed a shared-roll rules gap in **Steal**: the same Thievery check can now be compared against the Perception DC of the creature being robbed and any selected observers instead of forcing the workflow to one target.
- Updated the German and English Steal descriptions to make the victim-plus-observer workflow explicit while leaving protected-item and situational DC adjustments to the GM.
- Reduced successful GM-DC diagnostic traffic from console `info` to `debug`; the bounded client-local trace and `module.api.debug` inspection tools remain available.
- Synchronized module/package/runtime fallback versions and the release download URL to `0.1.0-rc.1`.
- Corrected the historical dev.18.6 diagnostics changelog heading.

### Review result

- Player Core skill-action catalog: complete for the defined scope.
- Common exploration layer and selected core utility actions: complete for the defined scope.
- Shared-roll observer model: complete for the reviewed base actions, including Steal secondary observers.
- Prerequisite/equipment validation: release-ready for reliably machine-readable prerequisites; scene geometry, feat-specific substitutions, arbitrary Item/environment targets, and other context-heavy exceptions remain GM-adjudicated by design.
- Mechanical result automation remains intentionally partial where automatic mutation would require guessing player or GM intent.

### Tests

- Added RC metadata/packaging and Steal shared-roll regression coverage.
- Full suite passes **168/168 tests**; all shipped JavaScript syntax checks pass.

## 0.1.0-dev.18.7 – GM DC Dialog Localization Hotfix

### Fixed

- Fixed the GM DC dialog crashing before render on Foundry v14 with `TypeError: Cannot read properties of undefined (reading 'translations')`.
- The handoff formatter no longer detaches `game.i18n.format` from its localization object; it is now invoked with the correct `game.i18n` receiver so Foundry can access its internal translation state.
- Retained the dev.18.6 client diagnostics for further verification.

### Tests

- Added a regression test using a context-sensitive `i18n.format` implementation that fails when called unbound, matching the Foundry v14 failure observed in the GM log.

## 0.1.0-dev.18.6 – GM DC Client Diagnostics

### Added

- Added a client-local ring-buffer diagnostic trace for the complete GM-DC handoff lifecycle.
- GM-DC diagnostics are emitted at console `info` level with the prefix `[PF2E Action Forge][GM-DC]` so they are visible in the normal Foundry/Electron developer console.
- Added trace points for module initialization, broker selection, transient ChatMessage creation, `createChatMessage`/`updateChatMessage` hooks, every GM-side guard/drop reason, dialog opening/closing, pending-request resolution, socket acknowledgements/responses, User-query fallback, and final failure.
- Added a public development API for reading, displaying, copying, and clearing the trace on each client: `game.modules.get("pf2e-action-forge").api.debug`.
- Diagnostic snapshots include Foundry/PF2e/module versions, current user role, connected-user state, and relevant transport capabilities without exposing target defense values or credentials.

### Debug workflow

- After reproducing a failed player -> GM DC request, run `game.modules.get("pf2e-action-forge").api.debug.showGmDc()` in the console on both the player and GM clients.
- Use `copyGmDc()` to copy the JSON report to the clipboard, or `getGmDcText()` to print/read it directly.

## 0.1.0-dev.18.5 – GM DC Duplicate Delivery Hotfix

- Fixed the `duplicate-request` failure observed when a player requested a GM-defined DC. In Foundry v14 the same replicated transport message can reach the GM handler more than once while the first delivery is still waiting for the GM dialog.
- Reworked GM request de-duplication from a reject-on-second-delivery set into a shared promise cache keyed by requester + request id. Concurrent deliveries now join the same adjudication instead of one delivery invalidating the other.
- Late socket/query fallbacks reuse the already resolved adjudication for a short grace period, preventing duplicate GM dialogs without returning a false error to the player.
- A single player request therefore opens at most one GM DC dialog and all matching transport deliveries receive the same DC/cancel result.

### Tests

- Added regression coverage for two concurrent deliveries of the same GM-DC request: exactly one `DialogV2.input` is opened and both deliveries receive the same successful result.

## 0.1.0-dev.18.3 – GM DC Core Query Hotfix

- Restored Foundry v14's native `DialogV2.query(userId, "input", config)` as the primary player-to-GM DC handoff. This is the core API specifically intended to display a dialog on another connected user's client.
- Passes the selected GM's user id directly and keeps the remote dialog configuration strictly JSON-serializable.
- Retains the module socket implementation only as a compatibility fallback instead of making it the primary path.
- Keeps local GM execution on `DialogV2.input`.
- Added regression coverage for the exact core remote-dialog path before rolling.

## [0.1.0-dev.18.2] - 2026-08-24

### Fixed

- Fixed the remaining player-to-GM DC handoff failure seen in dev.18.1. The previous hotfix only used the module-socket fallback when `User#query` was missing; if `User#query` existed but rejected or failed at runtime, the request aborted before the socket path was attempted.
- GM DC adjudication now uses the Action Forge module socket as the primary transport and routes the request to exactly one deterministic active GM.
- Added a short acknowledgement handshake so a missing GM-side socket listener fails over quickly instead of leaving the player waiting for the full adjudication timeout.
- The GM opens the existing local `DialogV2.input` window and returns only the selected/calculated DC to the requesting player.
- `User#query` remains as a secondary fallback when the module socket is unavailable or fails to acknowledge.
- Socket responses are correlated to the original request and selected GM before they are accepted.

### Tests

- Added a cross-client socket regression test that simulates a player request, GM acknowledgement, GM dialog, and correlated response while `User#query` would fail.
- Retained query-fallback coverage for environments without the module socket.
- Automated suite remains at **158 passing tests**.

## [0.1.0-dev.18.2] - 2026-08-24

### Fixed

- Fixed player-to-GM DC handoff on Foundry v14. The previous implementation incorrectly treated `DialogV2.query` as a cross-client dialog transport, so a player's DC request did not open a window on the GM client.
- GM DC requests now use Foundry v14 `User#query`; the registered query handler runs on the selected GM client and opens `DialogV2.input` there.
- Added deterministic active-GM routing, a long adjudication timeout, and a targeted module-socket fallback for environments where `User#query` is unavailable.
- Expanded failure handling for unavailable dialogs, query failures, socket timeouts, and dialog errors.
- The level/difficulty DC assistant introduced in dev.18 remains available in the GM request dialog.

### Tests

- Replaced the incorrect mocked `DialogV2.query` transport test with a cross-client `User#query` regression test that verifies the dialog is created on the GM side.
- Added bootstrap regression checks ensuring the GM DC query handler and fallback transport are initialized.
- Automated suite remains at **158 passing tests**.

## [0.1.0-dev.18] - 2026-08-24

### Added

- Added a **level-based DC assistant** for every workflow where the GM supplies an adjudicated/manual DC.
- The helper reproduces the **DCs by Level** table for levels 0-25 and the difficulty adjustments from *GM Core / Kernregeln: Spielleitung* p. 53.
- GM users can choose a level and difficulty directly in the Action Forge workspace; the calculated DC is inserted into the existing manual DC field automatically and remains editable.
- Player-triggered GM DC requests now include the same level/difficulty helper in the remote GM dialog. The GM can either type a DC or leave the manual field blank and have Action Forge calculate it from the selected level and difficulty.
- Added a neutral **Standard (±0)** option representing the unadjusted level DC alongside the six published difficulty adjustments.

### Tests

- Added regression coverage for the complete level table, all six difficulty adjustments, invalid input, GM-handoff calculation, manual-DC precedence, and both UI integration points.
- Automated suite now contains **158 passing tests**.

## [0.1.0-dev.17] - 2026-08-24

### Added

- Added declarative `prerequisites` metadata to Action Registry definitions with normalized, deep-frozen entries.
- Added the shared `PrerequisiteValidator` for equipment, movement-speed, target-trait, target-state, and target-statistic-rank requirements.
- Added a Foundry v14 GM prerequisite broker for opaque picker targets. The broker returns only validation results, never hidden target statistics.
- Added hard healer's-toolkit checks for Administer First Aid, Treat Disease, Treat Poison, and Treat Wounds; First Aid also validates held/worn access and the selected dying/bleeding target state.
- Added explicit prerequisite substitutions/waivers for Violet Ray, Right-Hand Blood / Blut der rechten Seite, and Aeonbound Treat Wounds targets so hard validation respects known PF2e rules exceptions.
- Added Treat Wounds validation for a living, actually wounded/damaged target.
- Added repair-toolkit validation for Repair and alchemist-toolkit validation for Identify Alchemy.
- Added fly-Speed validation for Maneuver in Flight, animal-trait validation for Command an Animal, and expert-rank validation for Follow the Expert.
- Added advisory thieves'-tools checks for Pick a Lock and Disable a Device, preserving their explicit GM-dependent exceptions.

### Security & rules fidelity

- Privileged application writes re-run hard prerequisites against authoritative Actor documents before the first mutation of a result transaction.
- Opaque target validation does not expose HP, defenses, traits, or skill ranks to the player; only pass/fail metadata and safe message keys are returned.
- Result transactions remain coherent after their first authorized mutation, so healing or condition changes caused by one Treat Wounds effect cannot invalidate the remaining effects from the same roll.
- Item/document context that cannot yet be represented reliably, such as the exact damaged object being Repaired, remains GM-adjudicated instead of being guessed.

### Tests

- Added regression coverage for toolkit aliases, explicit toolkit substitutions/waivers and equipment usage, Treat Wounds target eligibility, First Aid state checks, persistent bleed, animal targets, fly Speed, Follow the Expert rank validation, advisory Thievery exceptions, registry immutability, and UI/broker integration.
- Automated suite now contains **153 passing tests**.

## [0.1.0-dev.16] - 2026-08-24

### Added

- Added authoritative shared-roll/multi-target resolution: one PF2e roll is compared against every selected observer DC without rerolling.
- Added `sharedRoll` execution metadata and ActionRegistry normalization for observer-based actions.
- Added the GM-side `SharedRollResolver` broker with source ownership checks, target revalidation, hidden-defense isolation, natural 20/1 degree adjustment, and per-target result summaries.
- Enabled multi-target execution for Palm an Object, Create a Diversion, Lie, Conceal an Object, Hide, and Sneak.
- Added a shared-target DC state so multi-target actions never resolve only the first target or request multiple client-side DCs.

### Security & visibility

- Numeric target defenses never return to a player through the shared-roll broker.
- Secret outcome profiles remain GM-only; public profiles expose only target names and degree-of-success outcomes.
- GM-side target legitimacy and source-actor authority are revalidated before any comparison is accepted.

### Notes

- Conceal an Object reuses one roll across all observers selected in the current workflow. Later passive observers that were not selected still require GM adjudication until object-specific concealment state exists.
- Prerequisite & Equipment Validation remains the final planned pre-RC hardening block for dev.17.
- Automated suite now contains **143 passing tests**.
- Added `docs/SHARED_ROLL_MULTI_TARGET_REVIEW.md` with the implementation review and remaining persistence boundary.

## [0.1.0-dev.15] - 2026-08-24

### Review & hardening

- Completed the **Full Action Catalog Integration Review** across all 65 current actions and activities.
- Confirmed the catalog split as 51 skill-action cards representing 50 distinct Player Core skill uses, 4 selected core utility actions, and 10 common exploration activities.
- Added cross-catalog regression gates for uniqueness, proficiency requirements, ActionRegistry normalization, localization references, secret visibility, exploration-mode contracts, GM DC authority, and application-effect safety.
- Deep-froze registered DC choice objects in ActionRegistry so consumers cannot mutate Aid, Learn a Spell, or Treat Wounds choice metadata after registration.
- Documented the two remaining pre-RC integration priorities: shared-roll/multi-target resolution and prerequisite/equipment validation.
- Added `docs/FULL_ACTION_CATALOG_INTEGRATION_REVIEW.md` with the complete review and roadmap.
- Synchronized manifest/package/UI version metadata and refreshed the documented automated-test total.

## [0.1.0-dev.14.1] - 2026-08-24

### Fixed
- Moved situational/manual DC authority from player clients to the GM. Players now use the existing GM DC handoff for manual environmental DCs and defense fallbacks when no resolvable target is available.
- Free-form custom values on fixed-choice DCs are now GM-only; player-side injected values are ignored by the resolver while rules-defined choices remain selectable.
- Hardened the manual DC input handler so DOM manipulation cannot submit a player-authored free-form DC.
- GM-supplied non-secret DC handoffs now display the generic GM-defined DC source text rather than implying every handoff is secret.

### Tests
- Added regression coverage for player/GM authority across manual DCs, target-defense fallbacks, and fixed-choice custom overrides.
- Automated suite now contains **127 passing tests**.

# Changelog

## [0.1.0-dev.14] - 2026-08-24

### Added

- Added a persistent **Exploration Mode** for the ten common Player Core exploration activities: Search, Follow the Expert, Sustain an Effect, Hustle, Detect Magic, Scout, Avoid Notice, Investigate, Defend, and Repeat a Spell.
- Exploration activities are stored as one active Actor flag and replace the previous activity when a new one is started. The Action Forge shows the current activity in a dedicated banner and lets the controlling player end it explicitly.
- Follow the Expert remembers both the selected expert target and the selected skill/Lore statistic so the exploration plan survives closing and reopening the Forge.
- Added the high-value core utility actions **Escape**, **Sense Motive**, **Seek**, and **Aid**.
- Escape offers Unarmed, Acrobatics, or Athletics as the check method and can resolve a selected creature's Athletics DC or accept a manual fallback DC for other immobilizing effects.
- Sense Motive uses Perception against Deception DC and keeps the check/result secret. Seek uses the PF2e secret Perception workflow without inventing one universal DC for potentially several hidden creatures or objects.
- Aid provides the standard DC 15 as the default with GM-adjustable custom DC support and a selectable skill/Lore check.
- Expanded direct target-statistic DC resolution to Athletics, Deception, and Thievery DCs for current and future core-action workflows.
- Exposed exploration-state read/clear helpers through the module API and refresh the open Forge when the exploration Actor flag changes.
- Added German and English localization and dedicated exploration-state UI styling.

### Changed

- The catalog now contains **65 actions/activities**: the complete 51-card skill-action surface from dev.13 plus 4 core utilities and 10 persistent exploration activities.
- Exploration activities no longer show a meaningless roll-visibility panel. They explicitly explain that no immediate d20 check is made and that relevant checks are resolved later when the situation calls for them.
- ActionRegistry now preserves exploration execution mode plus custom statistic selector labels/hints.
- PF2e Action Adapter treats exploration selections as state changes rather than fake rolls while continuing to delegate Escape, Sense Motive, Seek, and Aid to PF2e system actions where available.

### Current automation boundary

- dev.14 records the exploration activity and its configuration; it does **not** yet automatically grant Scout's +1 initiative bonus, maintain Raised Shield state for Defend, trigger future secret Search/Investigate checks, or repeatedly cast spells. Those effects remain PF2e/GM adjudication until a later integration block can apply them safely.
- Aid currently focuses on skill/Lore-based assistance. Attack-roll Aid remains a situational PF2e workflow because the Forge does not yet provide a generic attack selector for this action.
- Seek intentionally has no single Forge DC because one Seek can be compared against several different Stealth/detection DCs.

### Tests

- Added dev.14 regression coverage for catalog completeness, exploration persistence, replacement/clearing, registry normalization, skill DC resolution, PF2e utility delegation, and UI/localization wiring.
- Automated suite now contains **123 passing tests**.

## [0.1.0-dev.13.1] - 2026-08-24

### Fixed

- Fixed a registry-contract regression where dev.13 DC metadata was present in `CORE_ACTIONS` but discarded by `ActionRegistry` normalization before runtime consumers could use it.
- Preserved `dc.hidden`, restoring hidden GM-defined DCs for public statistic rolls such as **Earn Income** through the real registered-action path.
- Preserved `dc.allowCustom`, `choiceLabel`, `choiceHint`, `customLabel`, and `customHint`, restoring the complete **Learn a Spell** custom-DC and localized-selector workflow after registration.
- Updated the main module startup fallback version, removing the stale dev.10 fallback found during the integration review.

### Tests

- Added registry-path regression coverage for Earn Income hidden DC metadata and Learn a Spell custom fixed-choice metadata.
- Added runtime regression coverage proving that the DC Resolver accepts a custom Learn a Spell DC from a registered action and that the PF2e statistic adapter keeps a registered Earn Income DC hidden while the roll remains public.
- Synchronized manifest, package, UI fallback, startup fallback, and release download metadata to **0.1.0-dev.13.1**.
- Automated suite now contains **115 passing tests**.

## [0.1.0-dev.13] - 2026-08-24

### Added

- Expanded the enabled catalog from **43 to 51 actions** with the Knowledge, Magic & Downtime block, completing the distinct Player Core skill-action entries covered by the Action Forge catalog.
- Added trained **Identify Magic** with Arcana, Nature, Occultism, or Religion and a blind roll / GM-only outcome.
- Added trained **Decipher Writing** with Arcana, Society, Occultism, or Religion and the same secret-result workflow.
- Added trained **Learn a Spell** with the Player Core spell-rank DC table (15/18/20/23/26/28/31/34/36/41), localized material-cost reminders, and an optional custom DC for rarity or special circumstances.
- Added trained **Prepare from Another Spellbook** using Arcana and a GM-defined DC.
- Added trained **Earn Income** with Performance, Crafting, or character Lore skills and a GM-defined DC that remains hidden even though the work check itself is public.
- Added secret trained **Create Forgery** using Society against fixed DC 20.
- Added **Command an Animal** using Nature against the animal's Will DC.
- Added trained **Maneuver in Flight**, closing the Acrobatics movement-action gap left by dev.10.
- Added generic fixed-choice custom-DC support to the DC Resolver and UI, initially used by Learn a Spell.
- Added German and English localization for Arcana, Society, Nature, all new actions, and spell-rank/cost choices.
- Added dev.13 regression coverage for catalog completeness, trained skill sets, secret knowledge checks, custom fixed-choice DCs, hidden public-roll DCs, new action models, localization, and release metadata.

### Changed

- Direct PF2e statistic rolls now honor an action-level `dc.hidden` flag independently of roll visibility. This lets checks such as Earn Income remain publicly rolled without exposing the GM-selected DC.
- The generic statistic selector now has separate hints for workflows that include Lore skills and workflows that do not.
- Version metadata, application fallback version, manifest download URL, and package metadata are synchronized to dev.13.
- Automated suite now contains **111 passing tests**.

### Current automation boundary

- Earn Income resolves the chosen trained skill and check but does not automatically calculate or award coin, persist a job, or advance downtime days.
- Learn a Spell provides the standard rank DC/cost reference and check but does not consume materials or add the spell to a spellbook/repertoire.
- Prepare from Another Spellbook does not alter prepared spell slots automatically.
- Create Forgery resolves the secret Society check but does not create a Journal/Item document for the forgery.
- Command an Animal resolves the Nature check but does not inject or execute actions on the animal's turn.
- Maneuver in Flight resolves the Acrobatics check but leaves actual token movement to the player/GM.

## [0.1.0-dev.12] - 2026-08-24

### Added

- Expanded the enabled catalog from **32 to 43 actions** with the Medicine, Thievery & Crafting block.
- Added **Palm an Object**, **Steal**, trained **Disable a Device**, and trained **Pick a Lock** for Thievery.
- Added **Repair**, secret trained **Identify Alchemy**, and trained **Craft** for Crafting.
- Added **Administer First Aid: Stabilize**, **Administer First Aid: Stop Bleeding**, trained **Treat Disease**, and trained **Treat Poison** for Medicine.
- Split Administer First Aid into two cards because stabilization and bleeding treatment use different DC and outcome models.
- Added the `target-dying` DC strategy. Readable patients use the rule-derived stabilization DC of `15 + Dying`; opaque picker-only patients reuse the secure GM DC handoff without exposing condition state.
- Added declarative `condition-increase` applications, used by a First Aid critical failure to increase Dying by exactly 1 through the GM Broker.
- Added German and English localization for the Thievery/Crafting categories, all new actions, First Aid applications, and Dying DC presentation.
- Added dev.12 regression coverage for catalog registration, proficiency gates, DC/visibility models, stabilization, opaque targets, valued-condition increments, PF2e statistic fallback, and the dynamic footer.

### Changed

- GM DC handoff wording is now generic rather than secret-only, allowing public checks with GM-defined object, affliction, or environmental DCs to use the same secure workflow.
- A locally readable non-Dying patient is rejected immediately by First Aid: Stabilize rather than triggering an unnecessary GM handoff.
- The Action Forge footer now renders the actual module version dynamically instead of carrying a hardcoded development version.
- Automated suite now contains **102 passing tests**.

### Current automation boundary

- Repair does not yet select or mutate item HP; the current Target Resolver is creature-oriented.
- Craft does not yet create items or consume materials.
- Pick a Lock and Disable a Device do not yet persist multi-success progress or automatically break tools.
- Treat Disease and Treat Poison do not yet install the one-save-only +4/+2/−2 circumstance modifier on the patient.
- First Aid: Stop Bleeding does not automatically resolve persistent bleed recovery or critical-failure bleed damage.

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