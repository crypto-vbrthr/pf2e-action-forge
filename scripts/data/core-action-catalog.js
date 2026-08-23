/**
 * MVP action catalog.
 *
 * dev.5 adds visibility profiles and secret-check workflows. dev.6 adds safe
 * declarative applications for Athletics actions, and dev.7 adds the full
 * Treat Wounds result workflow.
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
    id: "climb",
    label: "PF2EActionForge.Actions.Climb.Name",
    description: "PF2EActionForge.Actions.Climb.Description",
    category: "athletics",
    categoryLabel: "PF2EActionForge.Categories.Athletics",
    categoryIcon: "fa-solid fa-dumbbell",
    categoryOrder: 20,
    order: 30,
    icon: "fa-solid fa-mountain",
    keywords: ["athletics", "manual", "dc", "movement"],
    target: { mode: "none", type: "creature", required: false },
    dc: { strategy: "manual" },
    systemAction: { slug: "climb" },
    execution: { enabled: true, statistic: "athletics" },
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
    execution: { enabled: false, statistic: "intimidation" },
    visibility: { announcement: "public", roll: "public", outcome: "public" }
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
