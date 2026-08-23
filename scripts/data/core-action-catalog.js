/**
 * Preview catalog for the 0.1.0 MVP action set.
 *
 * dev.2 deliberately provides catalog metadata only. Actual PF2e checks, target
 * resolution, DC resolution, visibility and outcome application are added by
 * later development blocks.
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
    keywords: ["knowledge", "recall", "secret"]
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
    keywords: ["acrobatics", "reflex", "movement"]
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
    keywords: ["athletics", "fortitude", "grabbed"]
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
    keywords: ["athletics", "reflex", "prone"]
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
    keywords: ["athletics", "manual", "dc", "movement"]
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
    keywords: ["deception", "perception", "secret", "social"]
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
    keywords: ["intimidation", "will", "frightened"]
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
    keywords: ["medicine", "healing", "immunity", "wounded"]
  }
]);
