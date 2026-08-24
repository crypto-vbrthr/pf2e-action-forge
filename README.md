# PF2E Action Forge

Development build **0.1.0-dev.12 - Medicine, Thievery & Crafting Actions**.

dev.12 expands the catalog from **32 to 43 actions** and adds the remaining core workflows for Medicine, Thievery, and Crafting. Administer First Aid is represented as two operational cards because Stabilize and Stop Bleeding use different DC and outcome logic.

## New in dev.12

### Thievery

- **Palm an Object** - Thievery against the Perception DC of an observer. Multiple observers can be selected, while one observer is resolved per check until per-target batching is implemented.
- **Steal** - Thievery against the selected creature's Perception DC.
- **Disable a Device** - trained Thievery against a GM-defined device DC.
- **Pick a Lock** - trained Thievery against a GM-defined lock DC.

### Crafting

- **Repair** - Crafting against the GM-defined repair/crafting DC.
- **Identify Alchemy** - trained, secret Crafting check with blind roll and GM-only outcome.
- **Craft** - trained Crafting check against the GM-defined item DC.

### Medicine

- **Administer First Aid: Stabilize** - Medicine against `15 + Dying`. On success or critical success, Action Forge can remove Dying through the GM Broker. On a critical failure, it can increase Dying by 1.
- **Administer First Aid: Stop Bleeding** - Medicine against the GM-defined bleeding-effect DC.
- **Treat Disease** - trained Medicine against the disease DC.
- **Treat Poison** - trained Medicine against the poison DC.
- Existing **Treat Wounds** remains fully integrated with healing, Wounded removal, timed immunity, out-of-combat foreign-PC targeting, and public result summary.

## First Aid target-aware DC

The DC Resolver now supports a dedicated `target-dying` strategy. If the target Actor is readable, the Forge derives the stabilization DC directly from the target's current Dying value. A readable target that is not Dying is rejected immediately instead of unnecessarily asking the GM for a DC.

If the patient is a secure picker-only target whose conditions are intentionally opaque to the player, the existing GM DC handoff is used instead. The player's client never receives the hidden target state.

The Application Engine also gains a declarative `condition-increase` effect so privileged condition changes such as **Dying 2 → Dying 3** remain validated and idempotent rather than relying on arbitrary client updates.

## GM-defined situational DCs

The previous secret-DC handoff is now worded generically as a **GM-defined DC** workflow. This allows public checks such as Disable a Device, Pick a Lock, Repair, Craft, Treat Disease, Treat Poison, and Stop Bleeding to use the same secure handoff when the player should not choose the relevant object, affliction, or environmental DC.

## UI

The wide 1120 px responsive catalog, purple execution-workflow block, preserved scroll/focus behavior, and dev.11.1 automatic scroll to **Selected Action** all remain intact. The footer version is now rendered from the actual module version instead of a hardcoded development string.

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

The dev.12 workflows intentionally stop where Action Forge does not yet have a safe item/affliction target model. **Repair** performs the Crafting check but does not automatically select or modify an item’s HP. **Craft** performs the rule check but does not create an item or consume raw materials. **Pick a Lock** and **Disable a Device** do not yet persist multi-success progress or automatically break tools on a critical failure. **Treat Disease** and **Treat Poison** currently resolve the Medicine check but do not create one-save-only +4/+2/−2 modifiers on the patient. **First Aid: Stop Bleeding** likewise leaves the persistent-damage recovery resolution to PF2e/GM adjudication.

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

## dev.12 manual test checklist

1. Test Palm an Object and Steal against a visible creature and confirm its Perception DC is used.
2. As a player, run Disable a Device and Pick a Lock and confirm the GM receives the DC handoff before the public Thievery check.
3. Confirm an untrained character cannot use Disable a Device, Pick a Lock, Identify Alchemy, Craft, Treat Disease, or Treat Poison.
4. Run Identify Alchemy and confirm both DC and outcome remain hidden from the player.
5. Test First Aid: Stabilize on Dying 1, Dying 2, and a non-Dying target. The first two should derive DC 16/17; the non-Dying target should be rejected.
6. On a successful stabilization, apply **Remove Dying** to a foreign player character through the GM Broker.
7. On a critical failure, apply **Increase Dying** and verify the valued condition increases by exactly 1.
8. Test First Aid: Stop Bleeding, Treat Disease, and Treat Poison with GM-supplied DCs.
9. Test Repair and Craft checks and confirm no item mutation is falsely implied yet.
10. Re-test Treat Wounds, Demoralize, and one secret social action to confirm dev.12 did not disturb existing broker and visibility behavior.

## Automated checks

```bash
npm test
npm run check
```

Current suite: **102/102 tests passing**.

The next expansion block can focus on **Knowledge, Magic & Downtime Actions** before the full integration review.
