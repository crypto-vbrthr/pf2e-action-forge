# PF2E Action Forge

Development build **0.1.0-dev.10 - Combat & Movement Actions**.

This build expands the original eight-action MVP into a **19-action core catalog** and widens the Action Forge so skill groups can show several actions side by side instead of becoming a long vertical scroll tunnel.

## New in dev.10

### Acrobatics

- **Balance** - Acrobatics against a manually supplied environmental DC.
- **Squeeze** - trained Acrobatics against a manually supplied environmental DC.

### Athletics

- **Shove** - Athletics against the target's Fortitude DC.
- **Reposition** - Athletics against the target's Fortitude DC.
- **Disarm** - trained Athletics against the target's Reflex DC.
- **Force Open** - Athletics against a manually supplied object/environment DC.
- **Swim** - Athletics against a manually supplied environmental DC.
- **High Jump** - Athletics against fixed DC 30.
- **Long Jump** - Athletics against fixed DC 15.

### Deception

- **Create a Diversion** - Deception against a target's Perception DC.
- **Feint** - trained Deception against a target's Perception DC.

The existing actions remain available: Recall Knowledge, Tumble Through, Grapple, Trip, Climb, Lie, Demoralize, and Treat Wounds.

## Wider action workspace

The default Action Forge window is now **1120 x 820 px** instead of the previous 700 px width. Action groups use a responsive grid with cards starting at roughly 235 px, so a normal desktop-sized Forge can generally show **four actions beside each other** in a skill category.

The window remains resizable. At narrower sizes the grid automatically drops to fewer columns and ultimately a single column, so the wider default does not turn small displays into a horizontal-scroll experiment.

## PF2e execution model

The newly added actions delegate their actual checks to PF2e system actions. Action Forge supplies the acting Actor, statistic, selected target, resolved DC, visibility profile, and workflow state while PF2e remains authoritative for the check itself, including rule elements, roll options, modifiers, degree-of-success handling, and system action notes.

DC models in this build are deliberately explicit:

- **Fortitude DC:** Shove, Reposition
- **Reflex DC:** Disarm
- **Perception DC:** Create a Diversion, Feint
- **Fixed DC:** High Jump 30, Long Jump 15
- **Manual/environmental DC:** Balance, Squeeze, Force Open, Swim

Target-defense actions retain the existing manual fallback for cases where no readable target is available and the GM/player workflow legitimately needs an entered DC.

### Current automation boundary

Forced movement and positional consequences are **not automatically moving tokens** in dev.10. Shove and Reposition therefore use PF2e's system result text rather than Action Forge deciding where a creature may be moved.

Create a Diversion is modeled as a multiple-target action in the Target Resolver, but the current check pipeline still resolves **one target per execution** because different creatures can have different Perception DCs. This is the same deliberate limitation currently used by Lie and avoids pretending that one shared DC represents several creatures.

## Existing hardening retained

All previous player/security work remains in place:

- source Actor locking during a running action;
- Canvas, sidebar, and out-of-combat target selection;
- selection of other player characters without granting ownership;
- GM-side revalidation of privileged applications;
- Foundry v14 `User.query` broker transport with multi-GM failover;
- the existing **GM DC Handoff** for secret checks, without exposing hidden DCs or results;
- existing **Visibility Profiles** for public, player/GM, blind, GM-only, self, and suppressed output;
- idempotent result application and duplicate-click protection;
- timed/source-specific action immunities;
- Treat Wounds healing and public treatment summaries;
- Demoralize frightened application and ten-minute source-specific immunity;
- hidden/deleted target hardening;
- preserved scroll position and input focus across rerenders.

## dev.10 manual test checklist

1. Open Action Forge and confirm the wider window shows several actions per skill row without horizontal scrolling.
2. Resize the window narrower and confirm action cards reflow cleanly.
3. Test Balance, Squeeze, Force Open, and Swim with manual DCs.
4. Test High Jump at DC 30 and Long Jump at DC 15.
5. Test Shove and Reposition against another creature and confirm its Fortitude DC is used.
6. Test Disarm against a target and confirm its Reflex DC is used; confirm an untrained character cannot use the trained-only workflow.
7. Test Feint against Perception and confirm its trained requirement.
8. Test Create a Diversion against a selected target and verify PF2e performs the check normally.
9. Re-test the original eight actions, especially Treat Wounds, Demoralize, Lie, and Recall Knowledge, to confirm the expansion did not disturb broker or secrecy behavior.

## Automated checks

```bash
npm test
npm run check
```

Current suite: **87/87 tests passing**.

The next expansion block is expected to focus on **social and exploration skill actions** before the full MVP Integration Review.
