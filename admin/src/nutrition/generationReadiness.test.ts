import { describe, expect, it } from 'vitest'
import type { GeneratedPlan, GeneratedSlot, GeneratorOptions, GeneratorRecipe, GeneratorTarget, SlotType } from './generator'
import {
  combineReadiness,
  getGeneratedPlanActionState,
  getGenerationReadiness,
  getPublishReadiness,
  isGeneratorGuardrailsApproved,
  requiredRecipesPerSlot,
} from './generationReadiness'

const options: GeneratorOptions = {
  includeSnack: false,
  mealDistribution: null,
  dietaryPatterns: [],
  excludedAllergens: [],
  maxPrepTimeMin: null,
  maxRecipeRepeatsPerWeek: 2,
  dislikedRecipeIds: [],
  favouriteRecipeIds: [],
  seed: 1,
}

const target: GeneratorTarget = {
  calories: 2000,
  protein_g: 150,
  carbs_g: 200,
  fat_g: 60,
  calorie_tol_pct: 5,
  protein_tol_pct: 10,
  carbs_tol_pct: 15,
  fat_tol_pct: 15,
}

function recipe(id: string, slot: SlotType, overrides: Partial<GeneratorRecipe> = {}): GeneratorRecipe {
  return {
    id,
    name: id,
    calories: 500,
    protein_g: 30,
    carbs_g: 50,
    fat_g: 15,
    fiber_g: null,
    prep_time_min: 10,
    cook_time_min: 10,
    meal_types: [slot],
    dietary_patterns: [],
    allergens: [],
    is_active: true,
    eligible_for_generator: true,
    macros_verified: true,
    is_scalable: true,
    allowed_portions: null,
    ...overrides,
  }
}

function pool(counts: Partial<Record<SlotType, number>>): GeneratorRecipe[] {
  return Object.entries(counts).flatMap(([slot, count]) =>
    Array.from({ length: count ?? 0 }, (_, index) => recipe(`${slot}-${index}`, slot as SlotType)))
}

function slot(slotType: SlotType, dayOfWeek: number): GeneratedSlot {
  const macros = {
    breakfast: { calories: 600, protein_g: 45, carbs_g: 60, fat_g: 18 },
    lunch: { calories: 800, protein_g: 60, carbs_g: 80, fat_g: 24 },
    dinner: { calories: 600, protein_g: 45, carbs_g: 60, fat_g: 18 },
    snack: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  }[slotType]
  return {
    slot: slotType,
    recipeId: `${dayOfWeek}-${slotType}`,
    recipeName: slotType,
    portionMultiplier: 1,
    ...macros,
    fiber_g: null,
    locked: false,
  }
}

function completePlan(): GeneratedPlan {
  return {
    days: Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      slots: (['breakfast', 'lunch', 'dinner'] as SlotType[]).map(slotType => slot(slotType, dayOfWeek)),
      totals: { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 60 },
      withinTolerance: true,
    })),
    score: 0,
    diagnostics: { poolSizePerSlot: {}, daysOutOfTolerance: [], notes: [] },
  }
}

function currentPool(plan: GeneratedPlan): GeneratorRecipe[] {
  const uniqueSlots = new Map<string, GeneratedSlot>()
  plan.days.forEach(day => day.slots.forEach(item => uniqueSlots.set(item.recipeId, item)))
  return [...uniqueSlots.values()].map(item => recipe(item.recipeId, item.slot, {
    name: item.recipeName,
    calories: item.calories / item.portionMultiplier,
    protein_g: item.protein_g / item.portionMultiplier,
    carbs_g: item.carbs_g / item.portionMultiplier,
    fat_g: item.fat_g / item.portionMultiplier,
    fiber_g: item.fiber_g == null ? null : item.fiber_g / item.portionMultiplier,
  }))
}

describe('generation readiness', () => {
  it('requires the guardrail environment flag to be exactly true', () => {
    expect(isGeneratorGuardrailsApproved('true')).toBe(true)
    expect(isGeneratorGuardrailsApproved('TRUE')).toBe(false)
    expect(isGeneratorGuardrailsApproved('1')).toBe(false)
    expect(isGeneratorGuardrailsApproved(undefined)).toBe(false)

    const readiness = getGenerationReadiness(pool({ breakfast: 4, lunch: 4, dinner: 4 }), options, false)
    expect(readiness.ready).toBe(false)
    expect(readiness.blockers).toContain('Set VITE_MEAL_PLAN_GENERATOR_GUARDRAILS_APPROVED=true after the Phase 0 launch guardrails are approved.')
  })

  it('requires four preference-compatible recipes in every enabled slot', () => {
    const recipes = [
      ...pool({ breakfast: 4, lunch: 4, dinner: 4, snack: 4 }),
      recipe('vegan-snack', 'snack', { dietary_patterns: ['vegan'] }),
    ]
    const readiness = getGenerationReadiness(recipes, {
      ...options,
      includeSnack: true,
      dietaryPatterns: ['vegan'],
    }, true)

    expect(readiness.ready).toBe(false)
    expect(readiness.blockers).toEqual([
      'Breakfast needs at least 4 preference-compatible recipes; found 0. Add or retag recipes, or relax the athlete filters.',
      'Lunch needs at least 4 preference-compatible recipes; found 0. Add or retag recipes, or relax the athlete filters.',
      'Dinner needs at least 4 preference-compatible recipes; found 0. Add or retag recipes, or relax the athlete filters.',
      'Snack needs at least 4 preference-compatible recipes; found 1. Add or retag recipes, or relax the athlete filters.',
    ])
  })

  it('does not require snack coverage when snack is disabled', () => {
    const readiness = getGenerationReadiness(pool({ breakfast: 4, lunch: 4, dinner: 4 }), options, true)
    expect(readiness).toEqual({ ready: true, blockers: [] })
  })

  it('derives the per-slot minimum from the weekly repeat cap', () => {
    expect(requiredRecipesPerSlot(1)).toBe(7)
    expect(requiredRecipesPerSlot(2)).toBe(4)
    expect(requiredRecipesPerSlot(3)).toBe(4)
    expect(requiredRecipesPerSlot(7)).toBe(4)
    expect(requiredRecipesPerSlot(0)).toBe(4)
  })

  it('blocks generation when a slot cannot fill 7 days at a strict repeat cap', () => {
    const readiness = getGenerationReadiness(pool({ breakfast: 4, lunch: 4, dinner: 4 }), { ...options, maxRecipeRepeatsPerWeek: 1 }, true)
    expect(readiness.ready).toBe(false)
    expect(readiness.blockers).toContain('Breakfast needs at least 7 preference-compatible recipes to fill 7 days at a weekly repeat limit of 1; found 4. Add or retag recipes, relax the athlete filters, or raise the repeat limit.')
  })

  it('is satisfied when each slot has enough recipes for a strict repeat cap', () => {
    const readiness = getGenerationReadiness(pool({ breakfast: 7, lunch: 7, dinner: 7 }), { ...options, maxRecipeRepeatsPerWeek: 1 }, true)
    expect(readiness).toEqual({ ready: true, blockers: [] })
  })
})

describe('generated plan action state', () => {
  it('only allows actions for new runs and saved drafts', () => {
    expect(getGeneratedPlanActionState(false, undefined).actionable).toBe(true)
    expect(getGeneratedPlanActionState(true, 'draft').actionable).toBe(true)
    expect(getGeneratedPlanActionState(true, 'published')).toMatchObject({ actionable: false, title: 'Published plan' })
    expect(getGeneratedPlanActionState(true, 'superseded')).toMatchObject({ actionable: false, title: 'Superseded plan' })
    expect(getGeneratedPlanActionState(true, 'failed')).toMatchObject({ actionable: false, title: 'Failed generation' })
    expect(getGeneratedPlanActionState(true, null)).toMatchObject({ actionable: false, title: 'Read-only plan' })
  })
})

describe('publish readiness', () => {
  it('requires all seven days and every required slot', () => {
    const plan = completePlan()
    plan.days[0] = { ...plan.days[0], slots: plan.days[0].slots.filter(item => item.slot !== 'dinner') }

    const readiness = getPublishReadiness(plan, target, options, currentPool(plan))

    expect(readiness.ready).toBe(false)
    expect(readiness.blockers).toContain('Monday is incomplete: missing Dinner.')
  })

  it('rejects extra or unknown slots', () => {
    const plan = completePlan()
    plan.days[0].slots.push({
      ...slot('snack', 0),
      slot: 'brunch' as SlotType,
      recipeId: '0-brunch',
      recipeName: 'brunch',
    })

    const readiness = getPublishReadiness(plan, target, options, currentPool(plan))

    expect(readiness.ready).toBe(false)
    expect(readiness.blockers).toContain('Monday has unexpected brunch slots. Remove them before publishing.')
  })

  it('recomputes tolerance from slot macros instead of trusting persisted flags or totals', () => {
    const plan = completePlan()
    plan.days[0] = {
      ...plan.days[0],
      slots: plan.days[0].slots.map(item => item.slot === 'lunch'
        ? { ...item, carbs_g: item.carbs_g + 100 }
        : item),
      totals: { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 60 },
      withinTolerance: true,
    }

    const recipes = currentPool(completePlan())
    const readiness = getPublishReadiness(plan, target, options, recipes)

    expect(readiness.ready).toBe(false)
    expect(readiness.blockers).toContain('Monday is outside the stored target tolerances. Adjust portions or regenerate before publishing.')
    expect(readiness.blockers).toContain('Monday Lunch has stale recipe details or macros. Regenerate the plan before publishing.')
  })

  it('requires snack on every day when the athlete enabled it', () => {
    const plan = completePlan()
    const readiness = getPublishReadiness(plan, target, { ...options, includeSnack: true }, currentPool(plan))

    expect(readiness.ready).toBe(false)
    expect(readiness.blockers).toContain('Monday is incomplete: missing Snack.')
    expect(readiness.blockers).toContain('Sunday is incomplete: missing Snack.')
  })

  it('blocks recipes that are no longer eligible or preference-compatible', () => {
    const plan = completePlan()
    const recipes = currentPool(plan).map(item => item.id === '0-breakfast'
      ? { ...item, macros_verified: false }
      : item)

    const readiness = getPublishReadiness(plan, target, options, recipes)

    expect(readiness.ready).toBe(false)
    expect(readiness.blockers).toContain('Monday Breakfast is no longer compatible with the athlete preferences or generator eligibility rules. Replace it before publishing.')
  })

  it('validates every reviewed portion against the current recipe rules', () => {
    const plan = completePlan()
    plan.days[0].slots[0] = { ...plan.days[0].slots[0], portionMultiplier: 1.3 }
    const recipes = currentPool(completePlan()).map(item => item.id === '0-breakfast'
      ? { ...item, allowed_portions: [0.5, 1, 1.5] }
      : item)

    const readiness = getPublishReadiness(plan, target, options, recipes)

    expect(readiness.blockers).toContain('Monday Breakfast uses a portion (1.3×) that is no longer allowed for breakfast.')
  })

  it('accepts float32-style snapshot rounding within the database attestation tolerance', () => {
    const plan = completePlan()
    plan.days[0].slots[0] = {
      ...plan.days[0].slots[0],
      calories: plan.days[0].slots[0].calories + 0.0005,
      protein_g: plan.days[0].slots[0].protein_g - 0.0005,
    }

    const readiness = getPublishReadiness(plan, target, options, currentPool(completePlan()))

    expect(readiness.blockers).not.toContain('Monday Breakfast has stale recipe details or macros. Regenerate the plan before publishing.')
  })

  it('enforces positive repeat caps while treating zero as unlimited', () => {
    const plan = completePlan()
    plan.days = plan.days.map(day => ({
      ...day,
      slots: day.slots.map(item => item.slot === 'breakfast'
        ? { ...item, recipeId: 'shared-breakfast' }
        : item),
    }))
    const recipes = currentPool(plan)

    expect(getPublishReadiness(plan, target, options, recipes).blockers)
      .toContain('breakfast appears 7 times, above the weekly limit of 2.')
    expect(getPublishReadiness(plan, target, { ...options, maxRecipeRepeatsPerWeek: 0 }, recipes))
      .toEqual({ ready: true, blockers: [] })
  })

  it('accepts a complete in-tolerance plan even when persisted tolerance flags are false', () => {
    const plan = completePlan()
    plan.days = plan.days.map(day => ({ ...day, withinTolerance: false }))

    expect(getPublishReadiness(plan, target, options, currentPool(plan))).toEqual({ ready: true, blockers: [] })
  })

  it('keeps a complete plan blocked from publishing until launch guardrails are approved', () => {
    const launchReadiness = getGenerationReadiness(pool({ breakfast: 4, lunch: 4, dinner: 4 }), options, false)
    const plan = completePlan()
    const planReadiness = getPublishReadiness(plan, target, options, currentPool(plan))

    expect(combineReadiness(launchReadiness, planReadiness)).toMatchObject({
      ready: false,
      blockers: ['Set VITE_MEAL_PLAN_GENERATOR_GUARDRAILS_APPROVED=true after the Phase 0 launch guardrails are approved.'],
    })
  })
})
