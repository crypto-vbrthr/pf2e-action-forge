# PF2E Action Forge

Development build **0.1.0-dev.9 - UX & Player Hardening**.

This build deliberately adds little new rules content. Instead it hardens the existing MVP workflows against the awkward things real Foundry sessions do: double-clicks, rerenders, hidden or deleted targets, multiple GMs, broker disconnects, duplicate chat renders, and secret outcomes.

## Included through dev.9

- all foundation, catalog, targeting, DC, Visibility Profiles, GM DC Handoff, Application Engine, Treat Wounds, and Demoralize features from dev.1-dev.8;
- an explicit execution lock while PF2e is processing a check, preventing duplicate rolls and target/action mutation;
- reliable cleanup of the frozen source Actor after completed or cancelled checks, even if later result processing fails;
- preserved outer scroll position and focused input across Action Forge rerenders;
- hidden Canvas targets filtered from player target resolution;
- stale, deleted, hidden, or mismatched token targets rejected again by the GM Broker at application time;
- secret/GM-only outcomes prevented from generating result-application cards on player clients;
- Foundry v14 `User.query` failover from the preferred active GM to another active GM for privileged applications and sanitized target-directory requests;
- multi-GM GM-DC handoff that fails over only on transport failure, never after a deliberate GM rejection;
- duplicate ChatMessage application clicks coalesced into one privileged request;
- clearer errors when a source/target disappears or the active GM connection is lost;
- German and English localization, release metadata, `CHANGELOG.md`, and MIT `LICENSE`.

## Out-of-combat target security model

The player does not receive a copy of another Actor's statistics. The GM sends only safe display metadata: Actor UUID, name, image, type, target category, and whether the Actor is currently unavailable for the selected action. HP, defenses, conditions, notes, hidden fields, and other document data stay on the GM side.

When an application is later requested, the GM Broker resolves the Actor by UUID and independently checks that the player was legitimately allowed to select that Actor through party membership, player-character assignment, ownership, a visible scene token, or ordinary Foundry visibility. This keeps out-of-combat selection useful without turning Action Forge into an Actor-directory information leak.

## dev.9 manual hardening test

1. Open Action Forge as a player, scroll down, type into search or a DC field, and trigger rerenders. Confirm scroll position and focus remain stable.
2. Start a PF2e check and double-click the execution button. Confirm only one check is created and the active action cannot be switched while the check is in flight.
3. Cancel or complete the PF2e roll dialog. Confirm the frozen source Actor is released and Action Forge returns to a clean state.
4. With two active GMs, start a privileged application or target-directory request, then disconnect the preferred active GM. Confirm the second active GM can answer without a long socket timeout.
5. For a GM-defined secret DC, disconnect the selected GM while the handoff is in transport and confirm failover works. Separately close/reject a valid GM dialog and confirm it is not forwarded to another GM.
6. Target a visible token, then delete it before applying the result. Confirm the application is rejected immediately and no Actor is modified.
7. Confirm hidden tokens and unrelated hidden GM Actors never appear as player targets.
8. Open/render the same result ChatMessage in more than one place and click the same application rapidly. Confirm the effect is applied only once.
9. Re-test Treat Wounds and Demoralize against another player's character without ownership. Confirm healing, conditions, and timed immunities still use the GM Broker correctly.
10. Re-test Lie and Recall Knowledge and confirm blind/GM-only outcomes do not leak an application card or hidden result to the player.

## Automated checks

```bash
npm test
npm run check
```

Current suite: **82/82 tests passing**.

The next planned block is **0.1.0-dev.10 - MVP Integration Review**.
