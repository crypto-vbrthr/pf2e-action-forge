# PF2E Action Forge

Development build **0.1.0-dev.13.1 - Registry DC Metadata Hotfix**.

dev.13 expands the catalog from **43 to 51 actions** and closes the remaining distinct **Player Core skill-action** gaps in the current Action Forge scope. The catalog now covers the core skill actions from Acrobatics through Survival while still delegating actual PF2e checks, modifiers, degree-of-success handling, and Rule Elements to the system wherever possible.

## New in dev.13.1

This hotfix closes the registry-contract issue found during the Player Core Integration & Completeness Review. Action definitions are normalized before the UI, DC Resolver, and PF2e adapter consume them; dev.13 introduced additional DC metadata that the registry did not preserve.

- `dc.hidden` now survives ActionRegistry normalization, so a public check such as **Earn Income** can still keep the GM-defined DC hidden.
- `dc.allowCustom`, `choiceLabel`, `choiceHint`, `customLabel`, and `customHint` now survive normalization, so **Learn a Spell** retains its custom rarity/special-circumstance DC workflow and localized UI labels.
- Runtime regression tests now register the real catalog through `ActionRegistry` before exercising the DC Resolver and PF2e statistic adapter. This prevents raw-catalog tests from masking future registry-contract regressions.
- Both module startup fallbacks now report the current module version instead of retaining an older dev fallback.

The action catalog itself is unchanged at **51 actions**.

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

The catalog now contains **51 distinct actions/activities**. Repeated generic actions such as Recall Knowledge, Earn Income, Identify Magic, Decipher Writing, and Learn a Spell appear once and offer the relevant skill choices rather than being duplicated under every skill heading.

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
- public, player/GM, blind, GM-only, self, and suppressed visibility profiles;
- duplicate-roll and duplicate-application protection;
- Treat Wounds healing, Wounded removal, timed immunity, and public healing summary;
- Demoralize frightened application and source-specific timed immunity;
- preserved scroll position and input focus across rerenders.

## dev.13 manual test checklist

1. Run Identify Magic and Decipher Writing as a player and confirm the roll is blind and the result is not exposed.
2. Try each with an untrained selected skill and confirm execution is blocked.
3. Run Learn a Spell with several spell ranks and verify the displayed DC/cost reference, then enter a custom rarity DC and confirm that value is used.
4. Run Earn Income with Performance, Crafting, and a Lore skill. Confirm the roll is public but the GM-selected DC is not printed to the player.
5. Run Prepare from Another Spellbook as a trained Arcana character and confirm the GM DC handoff works.
6. Run Create Forgery and confirm the check is blind against DC 20.
7. Select an animal and run Command an Animal against its Will DC.
8. Run Maneuver in Flight with a manual DC and confirm untrained Acrobatics is blocked.
9. Re-test Treat Wounds, Demoralize, one social secret action, and First Aid to confirm the expansion did not disturb existing broker/application flows.

## Automated checks

```bash
npm test
npm run check
```

Current suite: **115/115 tests passing**.

The Player Core Integration & Completeness Review has now been completed. After this hotfix, the next feature block can proceed to **Exploration Mode & Core Utility Actions**.
