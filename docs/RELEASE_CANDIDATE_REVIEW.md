# PF2E Action Forge 0.1.0-rc.1
## Release Candidate & Final Integration Review

**Review date:** 2026-08-24  
**Foundry target:** v14  
**PF2e minimum:** 8.4.0  
**Reviewed action surface:** 65 cards

## Executive verdict

**RC READY.**

The final integration pass found one rules-fidelity gap worth fixing before the first release candidate: **Steal** was still modeled as a single-target action even though Player Core allows the same Thievery result to be compared against the Perception DCs of other observers. rc.1 closes that gap and extends the existing shared-roll broker to Steal.

No additional release-blocking defect was found in the reviewed catalog, normalization, GM authority, visibility, prerequisite, exploration, application, localization, or release-metadata paths.

The automated suite now passes **168/168 tests**, and every shipped JavaScript entry covered by `npm run check` passes Node syntax validation.

## 1. Catalog and registry

**Status: PASS**

The release candidate contains 65 unique Action Forge cards:

- 51 skill-action cards representing 50 distinct Player Core skill uses;
- 4 selected core utility actions;
- 10 common Player Core exploration activities.

There are no `developmentOnly` catalog entries. Every definition survives `CORE_ACTIONS -> ActionRegistry` normalization, and normalized target, DC, execution, visibility, prerequisite, and DC-choice structures remain frozen.

The dev.13 metadata-loss defect remains closed: hidden DC metadata, custom fixed-choice metadata, and choice UI labels/hints survive registration.

## 2. Rules fidelity: shared rolls and observers

**Status: PASS after one rc.1 fix**

The final rule comparison found that **Steal** needed the shared-roll model. Player Core states that the Thievery result used to determine whether the carried item is stolen can also be compared against the Perception DCs of other observers. rc.1 therefore changes Steal to multi-target/shared-roll execution.

The current shared-roll surface is now:

1. Palm an Object
2. Steal
3. Create a Diversion
4. Lie
5. Conceal an Object
6. Hide
7. Sneak

The runtime contract remains:

```text
one PF2e statistic roll
    -> immutable roll snapshot
    -> authoritative GM target revalidation
    -> one defense lookup per selected creature
    -> one degree-of-success comparison per creature
    -> visibility-filtered result summary
```

Natural 20/1 degree adjustments are applied separately to each target comparison. Numeric target defenses remain on the GM side of the shared-roll broker.

### Steal boundary

Action Forge does not move or remove the stolen Item document. The selected creatures therefore represent the intended victim and relevant observers for resolution, while protected-item modifiers and the narrative consequence of detection remain GM-adjudicated. This avoids inventing inventory mutation or contextual modifiers that the current target model cannot prove.

### Conceal an Object boundary

One roll is reused for every passive observer selected for the current workflow. Reusing that same result for later, previously unselected passive observers would require persistent identification of the concealed object. That remains a GM responsibility until Action Forge gains Item/object state tracking.

## 3. GM-defined DCs and level-based DC assistant

**Status: PASS**

GM-defined and free-form situational DCs remain GM-authoritative. Players cannot enter or override arbitrary manual DC values through the Action Forge UI or resolver.

The level-based DC assistant reproduces the GM Core / Kernregeln: Spielleitung level table for levels 0 through 25 and its difficulty adjustments:

- Incredibly Easy: -10
- Very Easy: -5
- Easy: -2
- Standard: ±0, Action Forge convenience option
- Hard: +2
- Very Hard: +5
- Incredibly Hard: +10

The same helper is available when the GM initiates the action and when a player requests a GM-defined DC.

The real Foundry multiplayer failure discovered during dev.18 was traced to the GM dialog localization call rather than the transport. dev.18.7 fixed the unbound `game.i18n.format` call, and the complete player -> GM dialog -> returned DC workflow has since been confirmed in live Foundry testing.

### Information-boundary note

Target-defense values used by the shared-roll broker remain GM-side and are never returned numerically to the player. A manually adjudicated GM DC is different: the current architecture returns the chosen number to the requesting client so that the local PF2e check can be rolled against it with the DC hidden in the UI. This is authoritative and UI-hidden, but it is not intended as a cryptographic secrecy boundary against a player inspecting their own client runtime.

## 4. Prerequisites and equipment

**Status: PASS for machine-readable prerequisites**

The shared prerequisite validator is used both for immediate UI validation and for authoritative GM-side revalidation before privileged result application.

Covered examples include:

- healer's toolkit requirements and supported explicit replacements/waivers;
- valid Treat Wounds and First Aid target state;
- repair and alchemist toolkit requirements;
- Fly Speed for Maneuver in Flight;
- animal trait for Command an Animal;
- expert/statistic relationship for Follow the Expert;
- advisory thieves' tool handling where the rules permit GM exceptions.

The validator remains intentionally conservative. Scene geometry, reach, willingness, feat-specific hand substitutions, arbitrary Item/environment targets, and comparable fiction-heavy requirements are not hard-blocked unless Foundry data can establish them reliably.

## 5. Secret checks and visibility

**Status: PASS**

Secret workflows retain blind/GM-facing roll behavior and suppress player-side outcomes where appropriate. This includes the reviewed Perception, knowledge, identification, social, Stealth, Survival, and forgery workflows.

Foreign picker targets are sanitized. Hidden defenses are resolved by the GM rather than exposed through the picker payload. Result-application requests accept only allow-listed effects from registered action definitions and revalidate source ownership and target legitimacy before mutation.

## 6. Exploration activities

**Status: PASS for the defined 1.0 scope**

All ten common exploration entries use persistent exploration state instead of fake immediate checks. Selecting a new primary activity replaces the old one, and the current activity can be cleared explicitly.

The Forge records exploration intent. It deliberately does not yet simulate every downstream rule consequence, including automatic Search/Investigate triggers, repeated spell casting, spell sustaining, or all Defend/Scout encounter-transition effects. Those remain future integration depth rather than missing catalog entries.

## 7. Mechanical application layer

**Status: PASS, intentionally partial**

Privileged effects use transaction IDs, source ownership checks, target revalidation, prerequisite revalidation, allow-listed application definitions, and duplicate-application protection.

The strongest automated result paths remain Treat Wounds, First Aid stabilization, Demoralize, Grapple, and Trip condition application.

The following remain deliberately manual or partial:

- Repair and Craft do not mutate arbitrary Item documents;
- Pick a Lock / Disable a Device do not persist multi-success progress or tool breakage;
- Treat Disease / Treat Poison do not create the later-save modifier effect;
- Shove / Reposition do not move tokens;
- Trip critical-success damage remains manual;
- social attitude changes remain narrative;
- Command an Animal does not inject actions into another creature's turn;
- Aid covers the selected skill/Lore workflow rather than every possible attack-roll Aid case.

These are automation-depth choices, not release blockers.

## 8. Multiplayer and transport

**Status: PASS for the tested surface**

The final architecture contains bounded, deterministic GM routing and explicit failure responses. The GM-DC handoff uses the server-replicated ChatMessage path first, with socket acknowledgement and registered User-query fallback. Duplicate deliveries join one adjudication promise, preventing duplicate GM dialogs.

GM-DC diagnostics remain available through `game.modules.get("pf2e-action-forge").api.debug`. Routine trace entries now use console `debug` rather than `info`, while the local 300-entry diagnostic buffer remains available for troubleshooting.

## 9. Known non-blocking technical limitation

**Broker-only contextual PF2e modifiers: MEDIUM, accepted for rc.1.**

For a normal canvas target, PF2e can receive the real target Actor/Token and evaluate target-aware context. A deliberately opaque picker-only target can instead be resolved through a numeric GM-side defense without exposing the target Actor to the player's client. In that case, a player-side PF2e statistic roll cannot necessarily evaluate every third-party Rule Element whose modifier depends on a locally available target object.

This is secure and uncommon, but it is a genuine integration-depth limit. A future architecture could perform more of the target-context roll preparation authoritatively on the GM side. It is not treated as a 1.0 blocker because ordinary scene targeting retains target context and the module does not fabricate missing modifiers.

## 10. Localization, UI, and release metadata

**Status: PASS**

German and English localization expose identical key sets. The execution block remains visually separated from the catalog, explicit action selection scrolls to the execution workflow, and rerenders preserve the intended workspace behavior.

Release metadata is synchronized to `0.1.0-rc.1` in:

- `module.json`;
- `package.json`;
- runtime version fallbacks;
- release download URL.

Foundry compatibility remains minimum/verified v14 and PF2e minimum remains 8.4.0.

## 11. Automated release gates

The final suite contains **168 passing tests** covering the accumulated development surface, including:

- catalog size, uniqueness, normalization and immutability;
- DE/EN localization parity;
- fixed, manual, target-defense and GM-defined DC models;
- level-based DC calculation;
- secret visibility and outcome suppression;
- one-roll/many-DC resolution and natural 20/1 handling;
- roll-message verification for player shared-roll requests;
- prerequisite validation and GM revalidation;
- application idempotence and target/source authority;
- exploration persistence;
- GM-DC transport, fallback, duplicate delivery and localization regression cases;
- rc.1 release metadata and Steal observer handling.

`npm run check` also passes for every shipped JavaScript file listed in the package script.

## Release decision

**PF2E Action Forge 0.1.0-rc.1 is ready for live release-candidate smoke testing.**

No known HIGH-severity or release-blocking finding remains from the reviewed Player Core-facing scope. If the live RC smoke test remains clean, the next step can be **1.0.0** without opening another feature block.
