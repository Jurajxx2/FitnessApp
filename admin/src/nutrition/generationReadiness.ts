import {
  filterPool,
  isWithinTargetTolerances,
  type GeneratedPlan,
  type GeneratedSlot,
  type GeneratorOptions,
  type GeneratorRecipe,
  type GeneratorTarget,
  type SlotType,
} from './generator'

export interface Readiness {
  ready: boolean
  blockers: string[]
}

export interface GeneratedPlanActionState {
  actionable: boolean
  title: string | null
  message: string | null
}

export const MIN_COMPATIBLE_RECIPES_PER_SLOT = 4

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
const SLOT_LABELS: Record<SlotType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

export function isGeneratorGuardrailsApproved(value: string | undefined): boolean {
  return value === 'true'
}

export function requiredSlots(includeSnack: boolean): SlotType[] {
  return includeSnack
    ? ['breakfast', 'lunch', 'dinner', 'snack']
    : ['breakfast', 'lunch', 'dinner']
}

export function combineReadiness(...checks: Readiness[]): Readiness {
  const blockers = checks.flatMap(check => check.blockers)
  return { ready: checks.every(check => check.ready), blockers }
}

export function getGeneratedPlanActionState(
  isPreview: boolean,
  generationStatus: string | null | undefined,
): GeneratedPlanActionState {
  if (!isPreview || generationStatus === 'draft') return { actionable: true, title: null, message: null }
  if (generationStatus === 'published') {
    return {
      actionable: false,
      title: 'Published plan',
      message: 'This saved version is already published and is available for review only.',
    }
  }
  if (generationStatus === 'superseded') {
    return {
      actionable: false,
      title: 'Superseded plan',
      message: 'A newer plan replaced this version. It is retained for history and is available for review only.',
    }
  }
  if (generationStatus === 'failed') {
    return {
      actionable: false,
      title: 'Failed generation',
      message: 'This generation attempt failed and cannot be resumed. Start a new generated plan instead.',
    }
  }
  return {
    actionable: false,
    title: 'Read-only plan',
    message: `This plan has an unsupported status (${generationStatus ?? 'missing'}) and cannot be changed safely.`,
  }
}

export function getGenerationReadiness(
  recipes: GeneratorRecipe[],
  options: GeneratorOptions,
  guardrailsApproved: boolean,
): Readiness {
  const blockers: string[] = []
  if (!guardrailsApproved) {
    blockers.push('Set VITE_MEAL_PLAN_GENERATOR_GUARDRAILS_APPROVED=true after the Phase 0 launch guardrails are approved.')
  }
  for (const slot of requiredSlots(options.includeSnack)) {
    const compatibleCount = filterPool(recipes, slot, options).length
    if (compatibleCount < MIN_COMPATIBLE_RECIPES_PER_SLOT) {
      blockers.push(`${SLOT_LABELS[slot]} needs at least ${MIN_COMPATIBLE_RECIPES_PER_SLOT} preference-compatible recipes; found ${compatibleCount}. Add or retag recipes, or relax the athlete filters.`)
    }
  }
  return { ready: blockers.length === 0, blockers }
}

function totalsForSlots(slots: GeneratedSlot[]) {
  return slots.reduce(
    (totals, slot) => ({
      calories: totals.calories + slot.calories,
      protein_g: totals.protein_g + slot.protein_g,
      carbs_g: totals.carbs_g + slot.carbs_g,
      fat_g: totals.fat_g + slot.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  )
}

export function getPublishReadiness(
  plan: GeneratedPlan,
  target: GeneratorTarget,
  options: GeneratorOptions,
  recipes: GeneratorRecipe[],
): Readiness {
  const blockers: string[] = []
  const slots = requiredSlots(options.includeSnack)
  const recipesById = new Map(recipes.map(recipe => [recipe.id, recipe]))
  const recipeUsage = new Map<string, number>()
  if (plan.days.length !== DAY_LABELS.length) {
    blockers.push(`Plan must contain exactly 7 days; found ${plan.days.length}. Regenerate the week before publishing.`)
  }

  DAY_LABELS.forEach((dayLabel, dayOfWeek) => {
    const matches = plan.days.filter(day => day.dayOfWeek === dayOfWeek)
    if (matches.length === 0) {
      blockers.push(`${dayLabel} is missing. Regenerate the week before publishing.`)
      return
    }
    if (matches.length > 1) {
      blockers.push(`${dayLabel} appears ${matches.length} times. Keep exactly one day before publishing.`)
      return
    }

    const day = matches[0]
    const extra = day.slots.filter(item => !slots.includes(item.slot as SlotType))
    if (extra.length) {
      blockers.push(`${dayLabel} has unexpected ${extra.map(item => SLOT_LABELS[item.slot as SlotType] ?? item.slot).join(', ')} slots. Remove them before publishing.`)
    }
    const missing = slots.filter(slot => !day.slots.some(item => item.slot === slot && item.recipeId))
    const duplicated = slots.filter(slot => day.slots.filter(item => item.slot === slot && item.recipeId).length > 1)
    if (missing.length) {
      blockers.push(`${dayLabel} is incomplete: missing ${missing.map(slot => SLOT_LABELS[slot]).join(', ')}.`)
    }
    if (duplicated.length) {
      blockers.push(`${dayLabel} has duplicate ${duplicated.map(slot => SLOT_LABELS[slot]).join(', ')} slots. Keep one recipe per slot.`)
    }
    for (const item of day.slots) {
      if (item.recipeId) recipeUsage.set(item.recipeId, (recipeUsage.get(item.recipeId) ?? 0) + 1)
      const source = recipesById.get(item.recipeId)
      const slotLabel = SLOT_LABELS[item.slot as SlotType] ?? item.slot
      if (!source) {
        blockers.push(`${dayLabel} ${slotLabel} references a recipe that is no longer available. Replace it before publishing.`)
        continue
      }
      if (!slots.includes(item.slot as SlotType)) continue
      if (!filterPool([source], item.slot as SlotType, options).length) {
        blockers.push(`${dayLabel} ${slotLabel} is no longer compatible with the athlete preferences or generator eligibility rules. Replace it before publishing.`)
      }
      if (!isAllowedPortion(source, item.portionMultiplier)) {
        blockers.push(`${dayLabel} ${slotLabel} uses a portion (${item.portionMultiplier}×) that is no longer allowed for ${source.name}.`)
      }
      if (!matchesCurrentSnapshot(item, source)) {
        blockers.push(`${dayLabel} ${slotLabel} has stale recipe details or macros. Regenerate the plan before publishing.`)
      }
    }

    if (!missing.length && !duplicated.length && !extra.length && !isWithinTargetTolerances(totalsForSlots(day.slots), target)) {
      blockers.push(`${dayLabel} is outside the stored target tolerances. Adjust portions or regenerate before publishing.`)
    }
  })

  if (options.maxRecipeRepeatsPerWeek > 0) {
    for (const [recipeId, usedCount] of recipeUsage) {
      if (usedCount <= options.maxRecipeRepeatsPerWeek) continue
      blockers.push(`${recipesById.get(recipeId)?.name ?? 'A recipe'} appears ${usedCount} times, above the weekly limit of ${options.maxRecipeRepeatsPerWeek}.`)
    }
  }

  return { ready: blockers.length === 0, blockers }
}

const PORTION_EPSILON = 1e-8
const SNAPSHOT_EPSILON = 0.001

function nearlyEqual(left: number, right: number): boolean {
  return Number.isFinite(left) && Number.isFinite(right)
    && Math.abs(left - right) <= PORTION_EPSILON * Math.max(1, Math.abs(left), Math.abs(right))
}

function isAllowedPortion(recipe: GeneratorRecipe, portion: number): boolean {
  if (!Number.isFinite(portion) || portion <= 0) return false
  if (recipe.allowed_portions?.length) return recipe.allowed_portions.some(allowed => nearlyEqual(portion, allowed))
  if (!recipe.is_scalable) return nearlyEqual(portion, 1)
  return portion >= 0.5 - PORTION_EPSILON
    && portion <= 2 + PORTION_EPSILON
    && nearlyEqual((portion - 0.5) / 0.25, Math.round((portion - 0.5) / 0.25))
}

function snapshotEqual(left: number, right: number): boolean {
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= SNAPSHOT_EPSILON
}

function matchesCurrentSnapshot(slot: GeneratedSlot, recipe: GeneratorRecipe): boolean {
  const multiplier = slot.portionMultiplier
  if (slot.recipeName !== recipe.name) return false
  if (!snapshotEqual(slot.calories, recipe.calories * multiplier)) return false
  if (!snapshotEqual(slot.protein_g, recipe.protein_g * multiplier)) return false
  if (!snapshotEqual(slot.carbs_g, recipe.carbs_g * multiplier)) return false
  if (!snapshotEqual(slot.fat_g, recipe.fat_g * multiplier)) return false
  if (recipe.fiber_g == null) return slot.fiber_g == null
  return slot.fiber_g != null && snapshotEqual(slot.fiber_g, recipe.fiber_g * multiplier)
}
