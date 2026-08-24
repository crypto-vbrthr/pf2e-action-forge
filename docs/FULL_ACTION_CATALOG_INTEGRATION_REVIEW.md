# PF2E Action Forge 0.1.0-dev.15
## Full Action Catalog Integration Review

Date: 2026-08-24

## Scope

This review checks the current Action Forge as one integrated Player Core-facing system rather than as isolated feature blocks. The basis is the German Pathfinder 2e Remaster **Kernregeln: Spieler**, the exploration guidance in **Kernregeln: Spielleitung**, and the current Action Forge runtime architecture.

The review covers:

- catalog completeness and classification;
- proficiency gates;
- target and DC models;
- GM authority over situational DCs;
- PF2e roll delegation and statistic fallback;
- secret-check visibility;
- ActionRegistry normalization and immutability;
- exploration persistence;
- application-effect safety;
- multiplayer and foreign-Actor architecture;
- remaining rule-fidelity and automation gaps.

## Executive result

**Catalog status: PASS**

The module contains **65 cards**:

- **51 skill-action cards**, representing **50 distinct Player Core skill uses** because Administer First Aid is intentionally split into Stabilize and Stop Bleeding;
- **4 selected core utility actions**: Escape, Sense Motive, Seek, Aid;
- **10 common exploration activities**.

No duplicate action IDs were found. All action/category/application localization keys referenced by the catalog exist in both German and English.

**Architecture status: PASS WITH FOLLOW-UP WORK**

Actor locking, safe foreign targets, GM DC handoff, secret visibility, PF2e delegation, application brokering, timed immunity and persistent exploration state remain internally consistent across the complete catalog.

**Release status: NOT YET RC**

Two remaining gaps are important enough to complete before a release candidate:

1. **Shared Roll / Multi-Target Resolution**
2. **Prerequisite & Equipment Validation**

## Findings

### 1. Full catalog and proficiency gates

Status: **PASS**

The reviewed skill surface covers the Player Core skill-action table and the generic multi-skill actions. Trained-only gates are present on the appropriate Action Forge workflows, including Earn Income, Identify Magic, Decipher Writing, Learn a Spell, Squeeze, Maneuver in Flight, Disarm, Pick a Lock, Feint, Track, Create Forgery, Identify Alchemy, Craft, Treat Disease, Treat Poison and Treat Wounds.

The catalog intentionally represents generic uses once and offers the relevant statistic selector instead of duplicating the same action under several skills.

### 2. ActionRegistry contract

Status: **PASS, one hardening fix applied in dev.15**

The dev.13.1 metadata-loss regression remains fixed. Target, DC, execution, visibility and application metadata survives normalization for all 65 definitions.

The review found one smaller immutability weakness: the `dc.choices` array was frozen, but the choice objects inside it were not. A consumer could therefore mutate a registered Treat Wounds or Learn a Spell choice globally after registration.

**Fixed in dev.15:** DC choice objects are now copied and frozen when registered. The integration suite verifies the full catalog through `CORE_ACTIONS -> ActionRegistry -> consumer` rather than relying only on raw definitions.

### 3. GM DC authority

Status: **PASS**

Free-form environmental and situational DCs remain GM-authoritative after normalization. A player-injected numeric DC does not become the check DC for `manual` or `gm-defined` workflows.

Rules-defined fixed choices remain player-selectable, such as Treat Wounds proficiency tiers and the normal Learn a Spell rank table. Arbitrary custom overrides remain GM-only.

### 4. Secret checks and information boundaries

Status: **PASS**

The reviewed secret workflows retain blind rolls and non-public outcomes where appropriate, including Sense Motive, Seek, Recall Knowledge, Identify Magic, Decipher Writing, Gather Information, Lie, Impersonate, Conceal an Object, Hide, Sneak, Sense Direction, Create Forgery and Identify Alchemy.

The player does not receive hidden target statistics merely because a foreign Actor is selected through the out-of-combat target picker. GM-side DC handoff and privileged application remain separate from ownership.

### 5. Exploration mode

Status: **PASS FOR THE CURRENT SCOPE**

All ten common exploration entries use the persistent `exploration-activity` execution mode and do not invent an immediate d20 roll. One activity replaces the previous one on the acting Actor, which matches the design intent that a character normally has one primary ongoing exploration activity at a time.

Follow the Expert additionally stores the chosen expert and statistic.

The current implementation records intent only. It does not yet automatically grant Scout initiative, maintain Raised Shield for Defend, trigger later Search/Investigate checks, or repeatedly cast/sustain spells. This remains an intentional automation boundary rather than a catalog defect.

### 6. Shared Roll / Multi-Target Resolution

Severity: **HIGH**

Status: **OPEN**

Several Player Core actions use one check and compare the same result against multiple observers. This matters because success can differ per observer without rerolling.

Current Action Forge metadata already identifies `Palm an Object`, `Create a Diversion`, and `Lie` as multi-target actions, but their execution is still guarded by `singleTargetOnly`. Other observer-based secret actions such as Sneak and Conceal an Object likewise need a shared-roll model rather than repeated independent checks.

Required architecture:

```text
one PF2e roll
    -> one immutable roll result
    -> N broker-side target DC resolutions
    -> N per-target degrees of success/outcomes
```

Hidden defenses must remain GM-side. The player should see only outcomes allowed by the action visibility profile.

Recommendation: **0.1.0-dev.16 - Shared Roll & Multi-Target Resolution**.

### 7. Prerequisite & Equipment Validation

Severity: **HIGH**

Status: **OPEN**

The catalog currently validates skill proficiency but not all action prerequisites. This is most important where Action Forge performs mechanical results itself.

Examples that should be represented declaratively:

- Medicine workflows that require a healer's toolkit;
- Treat Wounds target must be an eligible living creature;
- Repair requires repair tools and an appropriate item target;
- Identify Alchemy requires the relevant alchemical tools;
- Pick a Lock / Disable a Device require the appropriate tool context when the rules call for it;
- Maneuver in Flight should require a usable Fly Speed;
- Command an Animal should require an eligible animal target;
- Follow the Expert should verify the chosen expert/statistic relationship rather than only remembering the selection;
- Defend, Detect Magic, Repeat a Spell and Sustain an Effect should eventually validate that the actor can actually perform the recorded activity.

Recommended architecture:

```text
prerequisites: [
  { type: "item", slug: "...", usage: "held-or-worn" },
  { type: "target-trait", trait: "..." },
  { type: "movement-speed", speed: "fly" },
  { type: "statistic-rank", statistic: "...", minRank: 2 }
]
```

The same validator should run in the UI and again in the GM broker before privileged application. Client-side checks alone are insufficient.

Recommendation: **0.1.0-dev.17 - Prerequisite & Equipment Validation**.

### 8. Broker-only targets and contextual PF2e modifiers

Severity: **MEDIUM**

Status: **OPEN**

For ordinary scene targets, the PF2e action receives the real target Actor/Token. For a picker-only foreign target, Action Forge can obtain a hidden numeric DC from the GM without exposing the Actor document to the player. This is secure, but the player-side PF2e action may then lack a real target object for target-dependent Rule Elements or contextual modifiers.

The shared-roll broker is the best place to resolve this cleanly: keep the target opaque on the player client and perform target-context evaluation on the authoritative side where required.

### 9. Mechanical result automation

Status: **PARTIAL BY DESIGN**

Current automated results are strongest for Treat Wounds, Demoralize, Grapple, Trip and First Aid stabilization. The following remain intentionally manual or partial:

- Repair and Craft do not mutate Item documents;
- Pick a Lock / Disable a Device do not persist multi-success progress;
- Treat Disease / Treat Poison do not create the one-save modifier effect;
- Shove / Reposition do not move tokens automatically;
- Trip critical-success damage remains manual;
- social attitude changes remain narrative;
- Command an Animal does not inject actions into the animal's turn;
- Aid currently supports skill/Lore checks, not attack-roll Aid.

These are not catalog-completeness failures. They are candidates for later automation only where the module can apply them without guessing player or GM intent.

### 10. Security and multiplayer

Status: **PASS FOR CURRENT TESTED SURFACE**

The existing architecture retains:

- source Actor ownership validation;
- source locking during a workflow;
- sanitized target picker data;
- GM-side revalidation of foreign target eligibility;
- Foundry v14 `User.query` privileged broker;
- deterministic/active-GM handling and failover;
- transaction IDs and duplicate-application protection;
- secret outcome suppression on player clients;
- no arbitrary player-provided Actor update payloads.

This review did not identify a new privilege-escalation path in the current application definitions.

## Automated review gates added in dev.15

The dev.15 test block adds cross-catalog checks for:

- version/release metadata synchronization;
- exact 65-card uniqueness and 51 + 4 + 10 split;
- reviewed trained-only proficiency gates;
- full ActionRegistry registration and deep-frozen DC choices;
- DE/EN localization coverage for every catalog reference;
- secret-check visibility contracts;
- persistent no-roll exploration contracts;
- GM authority over free-form DCs;
- application-effect type allow-list;
- explicit detection/documentation of the current shared-roll boundary.

## Recommended roadmap

### 0.1.0-dev.16 - Shared Roll & Multi-Target Resolution

Implement one-roll/many-DC evaluation, per-target outcomes, hidden broker-side defenses and observer-aware result presentation.

### 0.1.0-dev.17 - Prerequisite & Equipment Validation

Add declarative prerequisites, toolkit checks, target predicates and movement/ability prerequisites, with GM-side validation for privileged effects.

### After dev.17

Run a final automation-depth and release hardening review. Item mutation, Treat Disease/Treat Poison effects, forced movement and exploration consequences can then be classified as either RC requirements or deliberate post-1.0 enhancements.

## Release decision

**0.1.0-dev.15 is suitable as the reviewed integration baseline, but not yet as the release candidate.**

The catalog itself is complete for the defined Player Core-facing scope. The remaining work is now concentrated in cross-target rules fidelity and prerequisite enforcement rather than missing action cards.
