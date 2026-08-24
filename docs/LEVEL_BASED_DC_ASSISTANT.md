# PF2E Action Forge 0.1.0-rc.1

## Level-Based DC Assistant

This build adds a shared helper for adjudicated GM DCs. It is intentionally limited to workflows where Action Forge already grants DC authority to the GM.

### Rules basis

The calculator uses the level DC table and difficulty adjustments from *GM Core / Kernregeln: Spielleitung*, page 53:

- Levels 0 through 25 use their published base DCs.
- Difficulty adjustments are -10, -5, -2, +2, +5, and +10.
- `Standard` is an Action Forge convenience label for no adjustment (±0), meaning the base level DC is used unchanged.

### GM-originated workflow

When the GM executes an action with a manual/adjudicated DC, the DC panel shows the ordinary numeric field plus the level helper. Selecting a level and difficulty calculates the value and writes it into the normal DC field. The GM can then overwrite that value manually if the situation warrants it.

### Player-originated workflow

When a player action requires a GM-defined DC, Action Forge sends the request through the current GM-DC handoff to the selected active GM. The GM-side dialog includes the same level and difficulty selectors. The GM can either:

1. enter a manual DC, or
2. leave the manual field empty, choose level and difficulty, and confirm.

Manual entry has precedence if both paths are filled.

### Authority boundary

The helper does not give players authority over situational DCs. Player clients still only initiate the existing GM handoff. The chosen value is supplied through that GM-controlled workflow.
