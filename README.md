# PF2E Action Forge

Development build **0.1.0-dev.14 - Exploration Mode & Core Utility Actions**.

The Action Forge now contains **65 actions and activities**: the complete 51-card Player Core skill-action surface plus four selected core utility actions and all ten common Player Core exploration activities. The new exploration layer is persistent state rather than another pile of immediate d20 buttons.

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

The skill-action catalog contains **51 distinct actions/activities**; dev.14 adds 14 core/exploration entries for **65 total cards**. Repeated generic actions such as Recall Knowledge, Earn Income, Identify Magic, Decipher Writing, and Learn a Spell appear once and offer the relevant skill choices rather than being duplicated under every skill heading.

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

Current suite: **123/123 tests passing**.

The Player Core skill-action catalog and the common exploration/core-utility layer are now represented. The next major review can focus on multi-target/shared-roll resolution and deeper integration rather than catalog gaps.
