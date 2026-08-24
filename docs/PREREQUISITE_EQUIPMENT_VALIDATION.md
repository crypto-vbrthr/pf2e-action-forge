# PF2E Action Forge 0.1.0-dev.17
## Prerequisite & Equipment Validation

## Goal

The Action Forge already validated proficiency ranks before dev.17. This block adds the other prerequisites that can be determined reliably from PF2e Actor, Item, movement, trait, HP, and condition data without inventing GM rulings.

The guiding rule is conservative automation: a prerequisite is a hard blocker only when the Forge can determine it from stable game data. Situational requirements with explicit GM exceptions remain advisory.

## Declarative contract

Action definitions can now declare a `prerequisites` array. The Action Registry normalizes and deep-freezes every entry and its alias lists.

Supported prerequisite families in dev.17 are:

- `item`: required carried/equipped toolkit or other item, optionally with a usage constraint such as `held-or-worn`;
- `movement-speed`: a prepared movement mode such as a fly Speed;
- `statistic-rank`: a minimum rank on the acting Actor;
- `target-trait`: a required creature trait;
- `target-state`: a machine-readable target state such as dying, persistent bleed, or a living wounded Treat Wounds target;
- `target-statistic-rank`: a minimum rank on the selected target, used by Follow the Expert.

Each prerequisite can be `hard` or `advisory`. Hard failures stop execution. Advisory failures warn the user but preserve GM adjudication. Item prerequisites can also declare source-Actor or target-Actor feature waivers, allowing explicit PF2e exceptions to bypass a tool requirement without weakening the normal rule.

## Rules mapped in this block

### Medicine

- Administer First Aid: healer's toolkit must be held or worn.
- Stabilize: target must be at 0 HP and Dying.
- Stop Bleeding: target must currently take persistent bleed damage.
- Treat Disease: healer's toolkit required.
- Treat Poison: healer's toolkit required.
- Treat Wounds: healer's toolkit required; target must be a living creature that is damaged or has the Wounded condition.

Known explicit exceptions are modeled declaratively as well. A Violet Ray functions as a healer's toolkit. Right-Hand Blood / Blut der rechten Seite waives healer's tools for Administer First Aid, Treat Disease, and Treat Wounds, but not Treat Poison. An Aeonbound creature can have its own wounds treated by itself or allies without a healer's toolkit.

### Crafting

- Repair: repair toolkit required.
- Identify Alchemy: alchemist's toolkit required.

The current action model does not yet select arbitrary Item documents or environmental objects. Therefore dev.17 does not falsely claim to validate whether a particular door, shield, hazard component, unidentified object, or other scene object is the correct item context. That remains GM-defined until Item/object targeting is introduced as its own feature.

### Acrobatics and Nature

- Maneuver in Flight: acting Actor must have a usable fly Speed in prepared PF2e data, in addition to the existing trained Acrobatics gate.
- Command an Animal: selected creature must have the animal trait.

### Exploration

- Follow the Expert: the selected expert must be at least expert in the selected skill or Lore statistic.
- Willingness, social relationship, and whether following is practical in the current fiction remain GM context.

### Thievery

- Pick a Lock: missing thieves' tools produces an advisory warning because the rules allow the GM to permit improvised tools.
- Disable a Device: missing thieves' tools produces an advisory warning because the rules state that they are sometimes mandatory depending on the device.

## Authority and multiplayer

The same validator is used by the UI and authoritative GM paths.

For locally readable Actors, prerequisites are checked before any PF2e roll or exploration activity is started. When a target selected through the safe target picker is intentionally opaque to a player, a Foundry v14 `User.query` request asks one active GM to evaluate the unresolved prerequisites. The response contains only pass/fail metadata and localization keys, never target defenses, HP totals, skill ranks, or other hidden values.

For actions with privileged result application, the Application Broker validates prerequisites again against authoritative source and target Actor documents before the first mutation in the transaction. A client-side check therefore cannot authorize an invalid healing or condition change.

Once one effect in a valid transaction has applied, remaining effects from that same transaction do not re-run the prerequisite gate. This matters for Treat Wounds: the first effect can heal the patient or remove Wounded, and those legitimate changes must not invalidate the remaining effects or the intrinsic temporary immunity from the same resolved action.

## Intentional boundaries

The validator does not attempt to infer facts that Foundry cannot represent reliably or that the rules explicitly leave to the GM. In particular:

- no dedicated Item/environment-object target workflow is introduced in this block;
- Treat Disease and Treat Poison verify their tool requirement but do not guess which arbitrary affliction instance is being treated;
- adjacency, line of effect, social willingness, attitude, and comparable scene-fiction requirements are not reconstructed from incomplete data;
- Detect Magic, Defend, Repeat a Spell, and Sustain an Effect remain persistent exploration intent and do not yet prove that a particular spell, shield, or sustained effect is currently available.

These boundaries keep the prerequisite layer strict where PF2e data is authoritative and quiet where automation would otherwise become a rules hallucination.
