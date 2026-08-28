# PF2E Action Forge

Release candidate **0.1.0-rc.3.1 - Perform Variant Compatibility Hotfix**.

Action Forge contains **65 actions and activities**: **51 skill-action cards representing 50 distinct Player Core skill uses**, four selected core utility actions, and all ten common Player Core exploration activities.

## Release candidate rc.1

- Completed the final cross-catalog integration review of rules metadata, target/DC models, PF2e execution, visibility, GM brokering, prerequisites, application effects, exploration state, localization, release metadata, and multiplayer safeguards.
- **Steal** now supports the base-rule observer case with one immutable Thievery roll against the robbed creature and any selected observers.
- GM-DC diagnostics remain available through `game.modules.get("pf2e-action-forge").api.debug`, but routine successful traces use console `debug` instead of `info`.
- Release metadata and runtime fallback versions are synchronized to `0.1.0-rc.3.1`.
- Known automation boundaries are deliberate: Item-document mutation, contextual feat-specific exceptions, forced token movement, future Search/Investigate triggers, and similar campaign-state-heavy consequences remain PF2e/GM controlled.
- Release-candidate gate: **174/174 automated tests pass**, plus the complete JavaScript syntax check.

## New in dev.18.5

- Fixed the `duplicate-request` failure seen in real Foundry play when a GM-defined DC was requested by a player.
- The replicated GM request can be delivered more than once while the GM dialog is still pending. Those deliveries now **coalesce onto one shared adjudication promise** instead of treating the second delivery as an invalid second request.
- Exactly one GM DC dialog is opened for a requester/request-id pair. Concurrent ChatMessage deliveries and late socket/query fallbacks receive the same final DC or cancellation result.
- The successful adjudication is retained briefly so a late fallback cannot reopen the dialog.
- Automated suite: **161/161 passing tests**, including a dedicated concurrent duplicate-delivery regression test.

## New in dev.18.4

- Player-to-GM DC adjudication uses a transient whispered ChatMessage as the primary server-replicated handoff. The selected GM opens `DialogV2.input` locally and returns the adjudicated DC through the same document.
- Internal transport messages are hidden from chat and cleaned up after response replication.
- Socket and registered `User#query` paths remain bounded compatibility fallbacks.

## New in dev.18.2

- Fixed the remaining player-to-GM DC request failure from dev.18.1. The module socket is now the primary transport for GM DC adjudication, so the workflow does not depend on a successful `User#query`.
- Added a request acknowledgement from the selected GM. If the socket path is not actually received, Action Forge fails over after a few seconds instead of waiting for the full GM adjudication timeout.
- The selected GM still receives the same local `DialogV2.input` window with manual DC entry and the level/difficulty calculator from dev.18.
- Correlated socket responses are accepted only for the request id and selected GM expected by the player client.
- `User#query` remains available as a secondary fallback.
- Automated suite: **158/158 passing tests**.

## New in dev.18.1

- Introduced a targeted `User#query` handoff and local GM `DialogV2.input`. dev.18.2 supersedes its transport selection after a real-world runtime failure showed that the socket fallback was not reached when the query API existed but failed.

## New in dev.18

- When the GM must supply an adjudicated DC, Action Forge now offers a **DC by Level** helper based on the tables on page 53 of *GM Core / Kernregeln: Spielleitung*.
- Choose a level from 0-25 and a difficulty adjustment. The Forge calculates the resulting DC and fills the existing GM-only DC field, which can still be edited manually afterward.
- Available adjustments are Incredibly Easy (-10), Very Easy (-5), Easy (-2), Standard (±0), Hard (+2), Very Hard (+5), and Incredibly Hard (+10).
- The same helper is available in the remote GM dialog when a player requests a GM-defined DC, so both GM-originated and player-originated workflows use the same table and calculation logic.
- Manual GM entry remains authoritative. The calculator is a convenience tool, not a replacement for GM adjudication.
- Automated suite now contains **158 passing tests**.

## New in dev.17

- Added a declarative prerequisite layer to the Action Registry. Prerequisites are normalized and deep-frozen alongside target, DC, execution, visibility, and application metadata.
- Added shared UI/GM validation for machine-readable PF2e requirements. Opaque picker targets can be validated by an authoritative GM without returning hidden Actor statistics to the player.
- Medicine workflows now verify healer's toolkit access. **Administer First Aid** additionally requires the toolkit to be held or worn, and validates the selected Stabilize or Stop Bleeding target state.
- Explicit PF2e exceptions are represented instead of being crushed by the validator: a **Violet Ray** counts as a healer's toolkit; **Right-Hand Blood / Blut der rechten Seite** can waive healer's tools for Administer First Aid, Treat Disease, and Treat Wounds; and an **Aeonbound** patient can be treated with Treat Wounds without a healer's toolkit.
- **Treat Wounds** now requires healer's tools plus a living target that is actually damaged or has the Wounded condition before the check can proceed.
- **Repair** requires a repair toolkit and **Identify Alchemy** requires an alchemist's toolkit.
- **Maneuver in Flight** requires a usable fly Speed, **Command an Animal** requires an animal target, and **Follow the Expert** verifies that the chosen expert is at least expert in the selected skill or Lore.
- **Pick a Lock** and **Disable a Device** surface missing thieves' tools as advisory warnings rather than unconditional blockers. This preserves the Player Core GM exception for improvised lockpicks and the rule that thieves' tools are only mandatory for some devices.
- Privileged application writes re-run hard prerequisites on the authoritative Actor documents before the first mutation in a result transaction. Later effects from the same already-authorized transaction are not invalidated if the first effect itself changes HP or conditions.
- The remaining item-context boundary is deliberate: Repair and Identify Alchemy still use GM-defined item context rather than a dedicated Item-document target selector, so the Forge validates their required toolkits but does not pretend it can prove the nature or damage state of an arbitrary environmental object.
- Automated suite now contains **153 passing tests**.
- Added `docs/PREREQUISITE_EQUIPMENT_VALIDATION.md` with the rule mapping, validation architecture, broker boundary, and intentional limits.

## New in dev.16

- Added a shared-roll execution path for observer-based actions: exactly one PF2e statistic check is rolled, then an authoritative GM broker compares the immutable result against every selected target DC.
- Removed the temporary single-target execution limit from **Palm an Object**, **Create a Diversion**, and **Lie**. **Conceal an Object**, **Hide**, and **Sneak** now also accept multiple observer targets and use the same shared resolution model.
- Hidden Perception DCs remain GM-side. Public actions return only per-target outcomes to the acting player, while secret actions keep outcomes and target defenses GM-only according to the existing visibility profile.
- Added per-target local/chat summaries without exposing numeric target DCs in public workflows.
- Added a dedicated shared-target DC state so the ordinary DC resolver no longer binds the roll to the first target or opens one GM-DC prompt per observer.
- The special long-term reuse rule for **Conceal an Object** is supported for the observers selected for the current resolution. Reusing that result for later, previously unselected passive observers remains a manual GM responsibility because Action Forge does not yet track the concealed object itself.
- The remaining pre-RC blocker is **Prerequisite & Equipment Validation**, planned for dev.17.
- Added `docs/SHARED_ROLL_MULTI_TARGET_REVIEW.md` with the dev.16 architecture, security boundaries, and remaining Conceal an Object persistence limit.

## New in dev.15

- Completed a full cross-catalog integration review of all 65 definitions against the current Player Core-facing scope.
- Added integration gates for catalog uniqueness/splits, trained-only proficiency requirements, DE/EN localization coverage, secret visibility, GM DC authority, persistent exploration contracts, application type safety, and known multi-target boundaries.
- Re-routed the review tests through the normalized `ActionRegistry` contract rather than trusting raw catalog data alone.
- Hardened ActionRegistry immutability: objects inside `dc.choices` are now copied and frozen, preventing consumers from mutating registered Treat Wounds, Learn a Spell, or Aid DC choices globally.
- Confirmed the current release blockers are **Shared Roll / Multi-Target Resolution** and **Prerequisite & Equipment Validation**. The catalog itself is complete for the defined scope.
- Added `docs/FULL_ACTION_CATALOG_INTEGRATION_REVIEW.md` with the complete findings and recommended roadmap.

## New in dev.14.1

- Situational and environmental **manual DCs are now GM-authoritative**. Players no longer receive a numeric DC input for Balance, Climb, Swim, Force Open, Track, Request, Perform, Subsist, and similar actions. Pressing the action button requests the DC from an active GM through the existing handoff dialog.
- A missing target on actions with a defense-based manual fallback (for example Escape or Tumble Through) now follows the same GM handoff instead of letting the player invent the fallback DC.
- Free-form overrides on fixed-choice DCs are GM-only. Players may still select rules-defined choices such as Treat Wounds proficiency tiers or Learn a Spell spell-rank DCs, but arbitrary custom values are rejected by the resolver even if a client tampers with the UI.
- GM users can still enter all adjudicated/manual DCs directly.

## New in dev.14

### Persistent exploration mode

The Forge now offers **Search, Follow the Expert, Sustain an Effect, Hustle, Detect Magic, Scout, Avoid Notice, Investigate, Defend, and Repeat a Spell** as dedicated exploration activities. Starting one stores it on the acting Actor, replaces any previous exploration activity, and displays a persistent **Active Exploration Activity** banner when the Forge is reopened. The player can end the activity from that banner.

Exploration activities deliberately do not manufacture an immediate roll. Search and Investigate, for example, record what the character is doing so the relevant secret checks can be resolved when a clue, hazard, hidden creature, or other trigger actually matters.

**Follow the Expert** additionally remembers the selected expert and chosen skill/Lore statistic.

### Core utility actions

- **Escape** offers Unarmed, Acrobatics, or Athletics and can use a selected creature's Athletics DC or a manual fallback DC for another restraining effect.
- **Sense Motive** uses Perception against a selected target's Deception DC with a blind roll and GM-only outcome.
- **Seek** delegates the secret Perception check to PF2e without forcing one artificial DC onto a search that may involve several hidden targets or objects.
- **Aid** starts from DC 15, allows a GM-adjusted DC, and lets the acting character select a skill or Lore statistic for skill-based Aid.

The DC Resolver can now read prepared Athletics, Deception, and Thievery DCs from Actor statistics in addition to the existing defenses.

## Exploration automation boundary

dev.14 stores and presents the activity state, but it does not yet automatically grant Scout's +1 initiative bonus, keep a shield mechanically Raised for Defend, fire future Search/Investigate secret checks, or continuously recast spells. Those are intentionally left to PF2e/GM adjudication until the later integration layer can apply them without creating stale or misleading effects. Attack-roll Aid also remains outside the current skill/Lore selector.


## Critical Forge integration

Action Forge is optionally compatible with **PF2E Critical Forge**. Ordinary Action Forge skill checks are native PF2e ChatMessages and can already be processed by Critical Forge directly. Shared-roll actions need a small bridge because PF2e creates the single check before any observer DC is attached.

In `0.1.0-rc.3.1`, the GM-side shared-roll resolver forwards only the final critical skill categories to Critical Forge's public `api.cards.automation.processMessage()` pipeline. A single shared roll can therefore draw at most one critical-success card and one critical-failure card, regardless of how many observers were compared. The first target in each critical group is used as the representative target, while the group size is preserved in the Critical Forge runtime snapshot when token documents are available.

The integration is optional. Critical Forge must be active, its Critical Forge feature enabled, support the `skillCheckCriticals` API capability, and have the relevant skill critical behavior enabled. No hard module dependency is added.

## Features retained from dev.13

### General knowledge, magic, and downtime

- **Earn Income** - trained Performance, Crafting, or one of the acting character's Lore skills. The GM supplies the job DC; the d20 roll can stay public while the DC remains hidden.
- **Identify Magic** - trained Arcana, Nature, Occultism, or Religion. The check is blind and the result remains GM-only.
- **Decipher Writing** - trained Arcana, Society, Occultism, or Religion with the same secret-result workflow.
- **Learn a Spell** - trained tradition skill with the Player Core spell-rank DC table and material-cost reminder built into the DC selector. An adjusted DC can be entered for rarity or special circumstances.

### Skill-specific additions

- **Prepare from Another Spellbook** - trained Arcana with a GM-defined DC based on the spell and circumstances.
- **Maneuver in Flight** - trained Acrobatics with a manual environmental/maneuver DC. This is the movement action that was still missing after dev.10.
- **Create Forgery** - trained Society, secret check against fixed DC 20.
- **Command an Animal** - Nature against the selected animal's Will DC, with the usual manual fallback for unusual target situations.

## Cross-skill statistic selection

Identify Magic, Decipher Writing, Learn a Spell, and Earn Income can be used with more than one skill. Action Forge therefore presents the available prepared PF2e statistics rather than hardcoding one modifier.

Earn Income also includes the character's Lore skills. Identify Magic and Learn a Spell offer Arcana, Nature, Occultism, and Religion; Decipher Writing offers Arcana, Society, Occultism, and Religion. Trained-only workflows are blocked when the selected statistic does not meet the required proficiency.

## Learn a Spell DC reference

The selector exposes the standard rank/DC progression used by Player Core:

| Spell rank | DC | Material cost reminder |
| --- | ---: | ---: |
| Cantrip / 1st | 15 | 2 gp |
| 2nd | 18 | 6 gp |
| 3rd | 20 | 16 gp |
| 4th | 23 | 36 gp |
| 5th | 26 | 70 gp |
| 6th | 28 | 140 gp |
| 7th | 31 | 300 gp |
| 8th | 34 | 650 gp |
| 9th | 36 | 1,500 gp |
| 10th | 41 | 7,000 gp |

The cost is presented as a reference only. Action Forge does not remove money or materials in this build. The custom DC field exists so rarity or campaign circumstances can raise the check without replacing the standard table.

## Hidden DC with a public roll

Earn Income introduces a useful distinction between **roll visibility** and **DC visibility**. The character can make an ordinary public work check while the GM-selected job DC is passed to PF2e as hidden. This avoids turning every GM-set DC into a blind roll merely to conceal the target number.

Identify Magic, Decipher Writing, and Create Forgery remain genuinely secret workflows: their rolls are blind and their outcomes are GM-only.

## Current Player Core skill-action coverage

The skill-action catalog contains **51 cards representing 50 distinct Player Core skill uses**; dev.14 adds 14 core/exploration entries for **65 total cards**. Repeated generic actions such as Recall Knowledge, Earn Income, Identify Magic, Decipher Writing, and Learn a Spell appear once and offer the relevant skill choices rather than being duplicated under every skill heading.

This completes the current **skill-action** catalog target. It does not mean that every Basic Action, exploration activity, class action, feat action, spell action, or subsystem action in Pathfinder is part of Action Forge. Those are separate surfaces and should be evaluated deliberately during the integration review rather than silently folded into the skill catalog.

## Current automation boundary

The new actions resolve the rules-facing check workflow but deliberately stop before unsafe or campaign-state-heavy mutations:

- **Earn Income** does not calculate or award coin, persist job level, or advance downtime days.
- **Learn a Spell** does not consume materials or insert the learned spell into a spellbook/repertoire.
- **Prepare from Another Spellbook** does not alter prepared spell slots.
- **Create Forgery** does not create a Journal or Item document representing the forged text.
- **Command an Animal** does not inject movement/attacks into the animal's turn.
- **Maneuver in Flight** does not move the token automatically.

The same boundaries from dev.12 remain: Repair/Craft do not yet mutate item documents, locks/devices do not persist multi-success progress, and Treat Disease/Treat Poison do not yet create a one-save-only modifier effect.

## UI and hardening retained

The wide 1120 px responsive action grid, orange catalog, purple execution workflow, and dev.11.1 auto-scroll to **Selected Action** remain in place. Existing protections also remain active:

- source Actor locking while a workflow is active;
- Canvas, sidebar, and out-of-combat target selection;
- foreign player-character targets without granting ownership;
- GM-side validation of privileged applications;
- Foundry v14 `User.query` broker transport with multi-GM failover;
- secure **GM DC Handoff** for player checks whose difficulty must stay under GM control;
- public, player/GM, blind, GM-only, self, and suppressed visibility profiles;
- duplicate-roll and duplicate-application protection;
- Treat Wounds healing, Wounded removal, timed immunity, and public healing summary;
- Demoralize frightened application and source-specific timed immunity;
- preserved scroll position and input focus across rerenders.

## dev.14 manual test checklist

1. Start **Scout**, close and reopen Action Forge, and confirm the active exploration banner persists.
2. Start another exploration activity and confirm it replaces Scout; use **End** and confirm the banner disappears.
3. Start **Follow the Expert** with another PC and a selected skill/Lore entry and confirm both are remembered.
4. Test **Escape** with Athletics/Acrobatics/Unarmed and a selected target, plus a manual fallback DC when no creature provides the restraining effect.
5. Test **Sense Motive** as a player and confirm the roll/result remains secret.
6. Test **Seek** and confirm PF2e performs the secret Perception roll without Action Forge demanding one universal DC.
7. Test skill-based **Aid** with DC 15 and with a GM-adjusted custom DC.
8. Re-test Treat Wounds, Demoralize, one secret social action, and Learn a Spell to confirm the new categories did not disturb existing workflows.

## Automated checks

```bash
npm test
npm run check
```

At the dev.14 checkpoint: **143/143 tests passing**.

At that checkpoint, the Player Core skill-action catalog and the common exploration/core-utility layer were represented; later development added shared-roll handling, prerequisites, and the release-candidate hardening described above.


## GM DC diagnostics

The release candidate retains the client diagnostics introduced in dev.18.6 and records the GM-DC handoff lifecycle independently on every connected client. After reproducing a problem, open the Foundry developer console (F12 / Ctrl+Shift+I) and filter for `PF2E Action Forge][GM-DC`.

Useful console commands:

```js
game.modules.get("pf2e-action-forge").api.debug.showGmDc()
game.modules.get("pf2e-action-forge").api.debug.copyGmDc()
game.modules.get("pf2e-action-forge").api.debug.getGmDcText()
game.modules.get("pf2e-action-forge").api.debug.clearGmDc()
```

For cross-client failures, capture the report once on the requesting player client and once on the selected GM client. The two traces share the request id, which makes the exact point at which the handoff stops visible.
