/**
 * Core skill-action catalog.
 *
 * dev.10 expands the original MVP with combat and movement actions from
 * Acrobatics, Athletics, and Deception while keeping PF2e system actions as
 * the authoritative roll implementation.
 */
export const CORE_ACTIONS = Object.freeze([
  {
    id: "recall-knowledge",
    label: "PF2EActionForge.Actions.RecallKnowledge.Name",
    description: "PF2EActionForge.Actions.RecallKnowledge.Description",
    category: "general",
    categoryLabel: "PF2EActionForge.Categories.General",
    categoryIcon: "fa-solid fa-compass",
    categoryOrder: 0,
    order: 10,
    icon: "fa-solid fa-brain",
    keywords: ["knowledge", "recall", "secret"],
    target: { mode: "optional", type: "creature", required: false },
    dc: {
      strategy: "gm-defined",
      systemTargetFallback: true,
      systemTargetRequiresStatisticMatch: true,
      allowUnknown: true,
      systemTargetStatistics: ["arcana", "crafting", "medicine", "nature", "occultism", "religion", "society"]
    },
    systemAction: { slug: "recall-knowledge" },
    execution: {
      enabled: true,
      statistics: ["arcana", "crafting", "medicine", "nature", "occultism", "religion", "society"],
      includeLore: true,
      requiresStatistic: true
    },
    visibility: { announcement: "player-gm", roll: "blind", outcome: "gm" }
  },
  {
    id: "balance",
    label: "PF2EActionForge.Actions.Balance.Name",
    description: "PF2EActionForge.Actions.Balance.Description",
    category: "acrobatics",
    categoryLabel: "PF2EActionForge.Categories.Acrobatics",
    categoryIcon: "fa-solid fa-person-running",
    categoryOrder: 10,
    order: 5,
    icon: "fa-solid fa-scale-balanced",
    keywords: ["acrobatics", "balance", "movement", "manual", "dc"],
    target: { mode: "none", type: "creature", required: false },
    dc: { strategy: "manual" },
    systemAction: { slug: "balance" },
    execution: { enabled: true, statistic: "acrobatics" },
    visibility: { announcement: "public", roll: "public", outcome: "public" }
  },
  {
    id: "tumble-through",
    label: "PF2EActionForge.Actions.TumbleThrough.Name",
    description: "PF2EActionForge.Actions.TumbleThrough.Description",
    category: "acrobatics",
    categoryLabel: "PF2EActionForge.Categories.Acrobatics",
    categoryIcon: "fa-solid fa-person-running",
    categoryOrder: 10,
    order: 10,
    icon: "fa-solid fa-person-running",
    keywords: ["acrobatics", "reflex", "movement"],
    target: { mode: "single", type: "creature", required: false },
    dc: { strategy: "target-defense", defense: "reflex", manualFallback: true },
    systemAction: { slug: "tumble-through" },
    execution: { enabled: true, statistic: "acrobatics" },
    visibility: { announcement: "public", roll: "public", outcome: "public" }
  },
  {
    id: "squeeze",
    label: "PF2EActionForge.Actions.Squeeze.Name",
    description: "PF2EActionForge.Actions.Squeeze.Description",
    category: "acrobatics",
    categoryLabel: "PF2EActionForge.Categories.Acrobatics",
    categoryIcon: "fa-solid fa-person-running",
    categoryOrder: 10,
    order: 20,
    icon: "fa-solid fa-arrows-left-right-to-line",
    keywords: ["acrobatics", "squeeze", "exploration", "manual", "dc"],
    target: { mode: "none", type: "creature", required: false },
    dc: { strategy: "manual" },
    systemAction: { slug: "squeeze" },
    execution: { enabled: true, statistic: "acrobatics", minRank: 1 },
    visibility: { announcement: "public", roll: "public", outcome: "public" }
  },
  {
    id: "grapple",
    label: "PF2EActionForge.Actions.Grapple.Name",
    description: "PF2EActionForge.Actions.Grapple.Description",
    category: "athletics",
    categoryLabel: "PF2EActionForge.Categories.Athletics",
    categoryIcon: "fa-solid fa-dumbbell",
    categoryOrder: 20,
    order: 10,
    icon: "fa-solid fa-hand-fist",
    keywords: ["athletics", "fortitude", "grabbed"],
    target: { mode: "single", type: "creature", required: false },
    dc: { strategy: "target-defense", defense: "fortitude", manualFallback: true },
    systemAction: { slug: "grapple" },
    execution: { enabled: true, statistic: "athletics" },
    visibility: { announcement: "public", roll: "public", outcome: "public" },
    application: {
      mode: "confirm",
      outcomes: {
        criticalSuccess: [{ id: "restrained", type: "condition-add", condition: "restrained", target: "target" }],
        success: [{ id: "grabbed", type: "condition-add", condition: "grabbed", target: "target" }]
      }
    }
  },
  {
    id: "trip",
    label: "PF2EActionForge.Actions.Trip.Name",
    description: "PF2EActionForge.Actions.Trip.Description",
    category: "athletics",
    categoryLabel: "PF2EActionForge.Categories.Athletics",
    categoryIcon: "fa-solid fa-dumbbell",
    categoryOrder: 20,
    order: 20,
    icon: "fa-solid fa-person-falling",
    keywords: ["athletics", "reflex", "prone"],
    target: { mode: "single", type: "creature", required: false },
    dc: { strategy: "target-defense", defense: "reflex", manualFallback: true },
    systemAction: { slug: "trip" },
    execution: { enabled: true, statistic: "athletics" },
    visibility: { announcement: "public", roll: "public", outcome: "public" },
    application: {
      mode: "confirm",
      outcomeNotes: {
        criticalSuccess: "PF2EActionForge.Application.TripCriticalDamageNote"
      },
      outcomes: {
        criticalSuccess: [{ id: "prone", type: "condition-add", condition: "prone", target: "target" }],
        success: [{ id: "prone", type: "condition-add", condition: "prone", target: "target" }]
      }
    }
  },
  {
    id: "shove",
    label: "PF2EActionForge.Actions.Shove.Name",
    description: "PF2EActionForge.Actions.Shove.Description",
    category: "athletics",
    categoryLabel: "PF2EActionForge.Categories.Athletics",
    categoryIcon: "fa-solid fa-dumbbell",
    categoryOrder: 20,
    order: 30,
    icon: "fa-solid fa-person-walking-arrow-right",
    keywords: ["athletics", "fortitude", "shove", "forced movement", "attack"],
    target: { mode: "single", type: "creature", required: false },
    dc: { strategy: "target-defense", defense: "fortitude", manualFallback: true },
    systemAction: { slug: "shove" },
    execution: { enabled: true, statistic: "athletics" },
    visibility: { announcement: "public", roll: "public", outcome: "public" }
  },
  {
    id: "reposition",
    label: "PF2EActionForge.Actions.Reposition.Name",
    description: "PF2EActionForge.Actions.Reposition.Description",
    category: "athletics",
    categoryLabel: "PF2EActionForge.Categories.Athletics",
    categoryIcon: "fa-solid fa-dumbbell",
    categoryOrder: 20,
    order: 40,
    icon: "fa-solid fa-arrows-up-down-left-right",
    keywords: ["athletics", "fortitude", "reposition", "forced movement", "attack"],
    target: { mode: "single", type: "creature", required: false },
    dc: { strategy: "target-defense", defense: "fortitude", manualFallback: true },
    systemAction: { slug: "reposition" },
    execution: { enabled: true, statistic: "athletics" },
    visibility: { announcement: "public", roll: "public", outcome: "public" }
  },
  {
    id: "disarm",
    label: "PF2EActionForge.Actions.Disarm.Name",
    description: "PF2EActionForge.Actions.Disarm.Description",
    category: "athletics",
    categoryLabel: "PF2EActionForge.Categories.Athletics",
    categoryIcon: "fa-solid fa-dumbbell",
    categoryOrder: 20,
    order: 50,
    icon: "fa-solid fa-hand",
    keywords: ["athletics", "reflex", "disarm", "attack", "trained"],
    target: { mode: "single", type: "creature", required: false },
    dc: { strategy: "target-defense", defense: "reflex", manualFallback: true },
    systemAction: { slug: "disarm" },
    execution: { enabled: true, statistic: "athletics", minRank: 1 },
    visibility: { announcement: "public", roll: "public", outcome: "public" }
  },
  {
    id: "force-open",
    label: "PF2EActionForge.Actions.ForceOpen.Name",
    description: "PF2EActionForge.Actions.ForceOpen.Description",
    category: "athletics",
    categoryLabel: "PF2EActionForge.Categories.Athletics",
    categoryIcon: "fa-solid fa-dumbbell",
    categoryOrder: 20,
    order: 60,
    icon: "fa-solid fa-door-open",
    keywords: ["athletics", "force open", "door", "object", "manual", "dc"],
    target: { mode: "none", type: "creature", required: false },
    dc: { strategy: "manual" },
    systemAction: { slug: "force-open" },
    execution: { enabled: true, statistic: "athletics" },
    visibility: { announcement: "public", roll: "public", outcome: "public" }
  },
  {
    id: "climb",
    label: "PF2EActionForge.Actions.Climb.Name",
    description: "PF2EActionForge.Actions.Climb.Description",
    category: "athletics",
    categoryLabel: "PF2EActionForge.Categories.Athletics",
    categoryIcon: "fa-solid fa-dumbbell",
    categoryOrder: 20,
    order: 70,
    icon: "fa-solid fa-mountain",
    keywords: ["athletics", "manual", "dc", "movement"],
    target: { mode: "none", type: "creature", required: false },
    dc: { strategy: "manual" },
    systemAction: { slug: "climb" },
    execution: { enabled: true, statistic: "athletics" },
    visibility: { announcement: "public", roll: "public", outcome: "public" }
  },
  {
    id: "swim",
    label: "PF2EActionForge.Actions.Swim.Name",
    description: "PF2EActionForge.Actions.Swim.Description",
    category: "athletics",
    categoryLabel: "PF2EActionForge.Categories.Athletics",
    categoryIcon: "fa-solid fa-dumbbell",
    categoryOrder: 20,
    order: 80,
    icon: "fa-solid fa-person-swimming",
    keywords: ["athletics", "swim", "movement", "water", "manual", "dc"],
    target: { mode: "none", type: "creature", required: false },
    dc: { strategy: "manual" },
    systemAction: { slug: "swim" },
    execution: { enabled: true, statistic: "athletics" },
    visibility: { announcement: "public", roll: "public", outcome: "public" }
  },
  {
    id: "high-jump",
    label: "PF2EActionForge.Actions.HighJump.Name",
    description: "PF2EActionForge.Actions.HighJump.Description",
    category: "athletics",
    categoryLabel: "PF2EActionForge.Categories.Athletics",
    categoryIcon: "fa-solid fa-dumbbell",
    categoryOrder: 20,
    order: 90,
    icon: "fa-solid fa-arrow-up",
    keywords: ["athletics", "high jump", "jump", "movement", "dc 30"],
    target: { mode: "none", type: "creature", required: false },
    dc: { strategy: "fixed", value: 30 },
    systemAction: { slug: "high-jump" },
    execution: { enabled: true, statistic: "athletics" },
    visibility: { announcement: "public", roll: "public", outcome: "public" }
  },
  {
    id: "long-jump",
    label: "PF2EActionForge.Actions.LongJump.Name",
    description: "PF2EActionForge.Actions.LongJump.Description",
    category: "athletics",
    categoryLabel: "PF2EActionForge.Categories.Athletics",
    categoryIcon: "fa-solid fa-dumbbell",
    categoryOrder: 20,
    order: 100,
    icon: "fa-solid fa-arrow-right-long",
    keywords: ["athletics", "long jump", "jump", "movement", "dc 15"],
    target: { mode: "none", type: "creature", required: false },
    dc: { strategy: "fixed", value: 15 },
    systemAction: { slug: "long-jump" },
    execution: { enabled: true, statistic: "athletics" },
    visibility: { announcement: "public", roll: "public", outcome: "public" }
  },
  {
    id: "create-a-diversion",
    label: "PF2EActionForge.Actions.CreateADiversion.Name",
    description: "PF2EActionForge.Actions.CreateADiversion.Description",
    category: "deception",
    categoryLabel: "PF2EActionForge.Categories.Deception",
    categoryIcon: "fa-solid fa-masks-theater",
    categoryOrder: 30,
    order: 5,
    icon: "fa-solid fa-eye-slash",
    keywords: ["deception", "perception", "diversion", "hidden", "social"],
    target: { mode: "multiple", type: "creature", required: false },
    dc: { strategy: "target-defense", defense: "perception", manualFallback: true },
    systemAction: { slug: "create-a-diversion" },
    execution: { enabled: true, statistic: "deception", singleTargetOnly: true },
    visibility: { announcement: "public", roll: "public", outcome: "public" }
  },
  {
    id: "lie",
    label: "PF2EActionForge.Actions.Lie.Name",
    description: "PF2EActionForge.Actions.Lie.Description",
    category: "deception",
    categoryLabel: "PF2EActionForge.Categories.Deception",
    categoryIcon: "fa-solid fa-masks-theater",
    categoryOrder: 30,
    order: 10,
    icon: "fa-solid fa-masks-theater",
    keywords: ["deception", "perception", "secret", "social"],
    target: { mode: "multiple", type: "creature", required: false },
    dc: { strategy: "target-defense", defense: "perception", manualFallback: true },
    systemAction: { slug: "lie" },
    execution: { enabled: true, statistic: "deception", singleTargetOnly: true },
    visibility: { announcement: "none", roll: "blind", outcome: "gm" }
  },
  {
    id: "feint",
    label: "PF2EActionForge.Actions.Feint.Name",
    description: "PF2EActionForge.Actions.Feint.Description",
    category: "deception",
    categoryLabel: "PF2EActionForge.Categories.Deception",
    categoryIcon: "fa-solid fa-masks-theater",
    categoryOrder: 30,
    order: 20,
    icon: "fa-solid fa-hand-sparkles",
    keywords: ["deception", "perception", "feint", "off-guard", "trained"],
    target: { mode: "single", type: "creature", required: false },
    dc: { strategy: "target-defense", defense: "perception", manualFallback: true },
    systemAction: { slug: "feint" },
    execution: { enabled: true, statistic: "deception", minRank: 1 },
    visibility: { announcement: "public", roll: "public", outcome: "public" }
  },
  {
    id: "demoralize",
    label: "PF2EActionForge.Actions.Demoralize.Name",
    description: "PF2EActionForge.Actions.Demoralize.Description",
    category: "intimidation",
    categoryLabel: "PF2EActionForge.Categories.Intimidation",
    categoryIcon: "fa-solid fa-face-angry",
    categoryOrder: 40,
    order: 10,
    icon: "fa-solid fa-face-angry",
    keywords: ["intimidation", "will", "frightened"],
    target: { mode: "single", type: "creature", required: false },
    dc: { strategy: "target-defense", defense: "will", manualFallback: true },
    systemAction: { slug: "demoralize" },
    execution: { enabled: true, statistic: "intimidation" },
    visibility: { announcement: "public", roll: "public", outcome: "public" },
    application: {
      mode: "confirm",
      blockIfImmuneActionId: "demoralize",
      outcomes: {
        criticalSuccess: [
          { id: "frightened-2", type: "condition-add", condition: "frightened", value: 2, target: "target", label: "PF2EActionForge.Demoralize.ApplyFrightened2" },
          { id: "demoralize-immunity", type: "immunity", mode: "auto", actionId: "demoralize", durationSeconds: 600, sourceSpecific: true, target: "target", label: "PF2EActionForge.Demoralize.ApplyImmunity", name: "PF2EActionForge.Demoralize.ImmunityName", description: "PF2EActionForge.Demoralize.ImmunityDescription" }
        ],
        success: [
          { id: "frightened-1", type: "condition-add", condition: "frightened", value: 1, target: "target", label: "PF2EActionForge.Demoralize.ApplyFrightened1" },
          { id: "demoralize-immunity", type: "immunity", mode: "auto", actionId: "demoralize", durationSeconds: 600, sourceSpecific: true, target: "target", label: "PF2EActionForge.Demoralize.ApplyImmunity", name: "PF2EActionForge.Demoralize.ImmunityName", description: "PF2EActionForge.Demoralize.ImmunityDescription" }
        ],
        failure: [
          { id: "demoralize-immunity", type: "immunity", mode: "auto", actionId: "demoralize", durationSeconds: 600, sourceSpecific: true, target: "target", label: "PF2EActionForge.Demoralize.ApplyImmunity", name: "PF2EActionForge.Demoralize.ImmunityName", description: "PF2EActionForge.Demoralize.ImmunityDescription" }
        ],
        criticalFailure: [
          { id: "demoralize-immunity", type: "immunity", mode: "auto", actionId: "demoralize", durationSeconds: 600, sourceSpecific: true, target: "target", label: "PF2EActionForge.Demoralize.ApplyImmunity", name: "PF2EActionForge.Demoralize.ImmunityName", description: "PF2EActionForge.Demoralize.ImmunityDescription" }
        ]
      }
    }
  },
  {
    id: "treat-wounds",
    label: "PF2EActionForge.Actions.TreatWounds.Name",
    description: "PF2EActionForge.Actions.TreatWounds.Description",
    category: "medicine",
    categoryLabel: "PF2EActionForge.Categories.Medicine",
    categoryIcon: "fa-solid fa-kit-medical",
    categoryOrder: 50,
    order: 10,
    icon: "fa-solid fa-kit-medical",
    keywords: ["medicine", "healing", "immunity", "wounded"],
    target: { mode: "single", type: "creature", required: true },
    dc: {
      strategy: "fixed-choice",
      choices: [
        { value: 15, minRank: 1, label: "PF2EActionForge.TreatWounds.Proficiency.Trained" },
        { value: 20, minRank: 2, label: "PF2EActionForge.TreatWounds.Proficiency.Expert" },
        { value: 30, minRank: 3, label: "PF2EActionForge.TreatWounds.Proficiency.Master" },
        { value: 40, minRank: 4, label: "PF2EActionForge.TreatWounds.Proficiency.Legendary" }
      ]
    },
    systemAction: { slug: "treat-wounds" },
    execution: { enabled: true, mode: "statistic", statistic: "medicine", minRank: 1 },
    visibility: { announcement: "public", roll: "public", outcome: "public" },
    application: {
      mode: "confirm",
      blockIfImmuneActionId: "treat-wounds",
      outcomes: {
        criticalSuccess: [
          {
            id: "healing",
            type: "heal",
            target: "target",
            label: "PF2EActionForge.TreatWounds.ApplyHealing",
            formulaByDc: { 15: "4d8", 20: "4d8+10", 30: "4d8+30", 40: "4d8+50" }
          },
          { id: "remove-wounded", type: "condition-remove", condition: "wounded", target: "target", label: "PF2EActionForge.TreatWounds.RemoveWounded" },
          { id: "treat-wounds-immunity", type: "immunity", mode: "auto", actionId: "treat-wounds", durationSeconds: 3600, target: "target", label: "PF2EActionForge.TreatWounds.ApplyImmunity", name: "PF2EActionForge.TreatWounds.ImmunityName", description: "PF2EActionForge.TreatWounds.ImmunityDescription" }
        ],
        success: [
          {
            id: "healing",
            type: "heal",
            target: "target",
            label: "PF2EActionForge.TreatWounds.ApplyHealing",
            formulaByDc: { 15: "2d8", 20: "2d8+10", 30: "2d8+30", 40: "2d8+50" }
          },
          { id: "remove-wounded", type: "condition-remove", condition: "wounded", target: "target", label: "PF2EActionForge.TreatWounds.RemoveWounded" },
          { id: "treat-wounds-immunity", type: "immunity", mode: "auto", actionId: "treat-wounds", durationSeconds: 3600, target: "target", label: "PF2EActionForge.TreatWounds.ApplyImmunity", name: "PF2EActionForge.TreatWounds.ImmunityName", description: "PF2EActionForge.TreatWounds.ImmunityDescription" }
        ],
        failure: [
          { id: "treat-wounds-immunity", type: "immunity", mode: "auto", actionId: "treat-wounds", durationSeconds: 3600, target: "target", label: "PF2EActionForge.TreatWounds.ApplyImmunity", name: "PF2EActionForge.TreatWounds.ImmunityName", description: "PF2EActionForge.TreatWounds.ImmunityDescription" }
        ],
        criticalFailure: [
          { id: "damage", type: "damage", formula: "1d8", target: "target", label: "PF2EActionForge.TreatWounds.ApplyDamage" },
          { id: "treat-wounds-immunity", type: "immunity", mode: "auto", actionId: "treat-wounds", durationSeconds: 3600, target: "target", label: "PF2EActionForge.TreatWounds.ApplyImmunity", name: "PF2EActionForge.TreatWounds.ImmunityName", description: "PF2EActionForge.TreatWounds.ImmunityDescription" }
        ]
      }
    }
  }
]);
