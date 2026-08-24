# PF2E Action Forge

Development build **0.1.0-dev.11.1 - Selected Action Auto-Scroll**.

The dev.11.1 UX hotfix keeps the 32-action Social & Exploration build intact and makes action selection faster to operate: choosing an action now scrolls the workspace directly to the purple execution block where target, DC, visibility, and roll controls appear.


## New in dev.11.1

When an action card is selected, Action Forge now automatically scrolls the main workspace to the newly rendered **Selected Action** block. This avoids manually scrolling back up from long skill groups before choosing targets or resolving the check.

The behavior is intentionally one-shot: target changes, DC edits, statistic changes, and other rerenders still preserve the current scroll position and focused control. Smooth scrolling respects the operating system's reduced-motion preference.

## New in dev.11

### Performance

- **Perform** - Performance against a situational DC.

### Diplomacy

- **Make an Impression** - Diplomacy against a selected creature's Will DC.
- **Request** - Diplomacy with a situational DC chosen for the request.
- **Gather Information** - a secret Diplomacy check using the existing GM DC handoff.

### Deception

- **Impersonate** - a secret Deception check against an observer's Perception DC when an observer is selected; otherwise the hidden DC is supplied through the GM handoff.

### Intimidation

- **Coerce** - Intimidation against a selected creature's Will DC.

### Stealth

- **Conceal an Object** - secret Stealth against an observer's Perception DC, with GM handoff when the observer is not represented directly.
- **Hide** - secret Stealth against an observer's Perception DC, with GM handoff when needed.
- **Sneak** - secret Stealth against an observer's Perception DC, with GM handoff when needed.

### General and Survival

- **Subsist** - choose Society in a settlement or Survival in the wilderness, then roll against a situational DC.
- **Sense Direction** - secret Survival check using a GM-supplied hidden DC.
- **Track** - trained Survival against an environmental/trail DC.
- **Cover Tracks** - trained Survival exploration activity. It intentionally performs no immediate check: creatures following the trail make the relevant Track check against the character's Survival DC when applicable.

All 19 actions from dev.10 remain available, including the original MVP actions, Combat & Movement expansion, Treat Wounds, and Demoralize.

## Execution compatibility

Social and exploration actions introduce a new **system-or-statistic** execution mode. Action Forge first uses the matching PF2e system action when the installed PF2e version exposes one. If that action is not present in `game.pf2e.actions`, the Forge falls back to the Actor's prepared PF2e statistic instead of failing the workflow.

The fallback still delegates the actual check to PF2e. Rule Elements, prepared statistic modifiers, degree of success, roll dialog behavior, and check processing therefore stay under PF2e control rather than being reimplemented by Action Forge.

Secret statistic fallbacks preserve the visibility profile: hidden DCs are passed as hidden and the `secret` trait is retained.

## Secret observer checks

Impersonate, Conceal an Object, Hide, and Sneak can use a selected readable observer directly. Action Forge resolves that Actor's prepared **Perception DC** and performs the check secretly.

If no observer can safely be represented on the player's client, the Forge does not reveal or invent a Perception DC. Instead it uses the existing **GM DC Handoff**. The player sees neither the supplied DC nor the hidden outcome.

This also keeps the target picker security boundary intact: a UUID-only or otherwise non-readable target never causes hidden Actor statistics to be sent to the player.

## No-roll activities

The registry and PF2e adapter now support an **activity** execution mode for rulebook activities that do not call for an immediate check. **Cover Tracks** is the first use of this path. Starting it creates the configured public Action Forge announcement and then releases the frozen source Actor cleanly without manufacturing a d20 roll.

## Current automation boundary

Some social and stealth actions can logically involve several creatures with different defenses. dev.11 deliberately resolves **one observer/target per check** where a concrete target is used. In particular, the multi-target option of Make an Impression is not batch-automated yet.

Situational non-secret DCs such as Perform, Request, Track, and Subsist use the normal manual DC field. Secret or unknowable DCs use the GM handoff instead.

The Forge does not automatically change NPC attitudes, decide whether a request is reasonable, choose information learned, or narrate the consequences of Coerce. Those remain GM adjudication rather than hidden automation masquerading as rules.

## UI and hardening retained

The dev.10.1 wide responsive layout and purple execution-workflow block remain unchanged. Existing protections also remain in place:

- source Actor locking during an active workflow;
- Canvas, sidebar, and out-of-combat target selection;
- selection of other player characters without granting ownership;
- GM-side revalidation of privileged applications;
- Foundry v14 `User.query` broker transport with multi-GM failover;
- visibility profiles for public, player/GM, blind, GM-only, self, and suppressed output;
- duplicate-roll and duplicate-application protection;
- Treat Wounds healing, timed immunity, and public healing summaries;
- Demoralize frightened application and source-specific timed immunity;
- hidden/deleted target hardening;
- preserved scroll position and input focus across rerenders.

## dev.11 manual test checklist

1. Test Perform with a manual DC and verify PF2e uses Performance.
2. Test Make an Impression and Coerce against visible targets and confirm their Will DCs are used.
3. Test Request with a selected creature and a situational manual DC.
4. As a player, start Gather Information and Sense Direction and confirm the hidden GM DC handoff occurs before the blind check.
5. Test Impersonate, Conceal an Object, Hide, and Sneak with a readable observer and confirm the roll stays secret while using Perception DC.
6. Repeat one of those secret observer actions without a readable observer and confirm the GM DC handoff is used without exposing the DC or outcome.
7. Test Subsist and switch between Society and Survival before rolling.
8. Confirm an untrained character cannot use Track or Cover Tracks.
9. Start Cover Tracks and confirm it creates an activity announcement without an unnecessary d20 roll.
10. Re-test Treat Wounds and Demoralize on a foreign player character to confirm the social/exploration expansion did not disturb GM-brokered applications.

## Automated checks

```bash
npm test
npm run check
```

Current suite: **96/96 tests passing**.

The next expansion blocks can focus on the remaining **Medicine, Thievery, Crafting, Knowledge, and Magic** actions before the full integration review.
