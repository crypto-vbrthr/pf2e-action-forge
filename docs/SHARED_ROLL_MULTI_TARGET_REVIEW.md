# PF2E Action Forge 0.1.0-dev.16
## Shared Roll & Multi-Target Resolution Review

Date: 2026-08-24

## Result

**Status: PASS for the current Action Forge observer-target surface.**

Action Forge now supports the Pathfinder pattern **one check, several target DCs, separate outcomes** without rolling once per target.

The shared-roll path is active for:

- Palm an Object
- Create a Diversion
- Lie
- Conceal an Object
- Hide
- Sneak

## Runtime contract

```text
one PF2e statistic roll
    -> immutable roll snapshot
    -> GM-side source/target revalidation
    -> N target-defense lookups
    -> N degree-of-success comparisons
    -> visibility-filtered result summary
```

The player-side PF2e roll is deliberately created without binding it to a single target or DC. For a non-GM requester, the broker verifies the result against the PF2e ChatMessage produced by that roll and accepts a given roll message only once. Numeric target defenses remain GM-side.

Public actions return target names and per-target degrees of success, but not target DCs. Secret actions keep both outcomes and defenses on the GM side according to the existing visibility profile.

Natural 20 and natural 1 degree adjustments are applied separately to every target comparison after the base result is compared with that target's DC.

## Conceal an Object boundary

The current implementation correctly reuses one roll for all passive observers selected for the current workflow. The Player Core rule can also require the same result to be reused later when the concealed object passes additional passive observers. Action Forge does not yet identify or persist the concealed object itself, so previously unselected later observers remain GM-adjudicated rather than receiving a newly invented roll.

## Regression coverage

The dev.16 suite verifies:

- shared-roll metadata survives ActionRegistry normalization;
- the first selected target is no longer treated as the single DC source;
- one direct PF2e statistic roll is made with no target/DC binding;
- target outcomes can differ while sharing one roll total;
- natural 20/1 adjustments are handled per comparison;
- player requests are tied to their PF2e roll ChatMessage and cannot reuse one message for repeated resolution;
- public responses contain no numeric target defenses;
- secret responses contain no per-target outcome payload for the player;
- GM-only summaries retain the information needed to adjudicate secret checks.

## Next release block

The remaining pre-RC integration priority is **0.1.0-dev.17 - Prerequisite & Equipment Validation**.
