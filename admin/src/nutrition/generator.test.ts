import { describe, expect, it } from 'vitest'
import {
  adjustDay, bestPortion, filterPool, generateWeek, isWithinTargetTolerances, KCAL_TOLERANCE, mulberry32, PROTEIN_FLOOR, scoreCandidate, slotBudgets,
  restorePinnedSlotLockState, swapGeneratedSlot, type GeneratedSlot, type GeneratorOptions, type GeneratorRecipe, type SlotType,
} from './generator'

export const baseOptions: GeneratorOptions = {
  includeSnack: false, mealDistribution: null, dietaryPatterns: [], excludedAllergens: [],
  maxPrepTimeMin: null, maxRecipeRepeatsPerWeek: 2,
  dislikedRecipeIds: [], favouriteRecipeIds: [], seed: 42,
}

export function recipe(overrides: Partial<GeneratorRecipe> & { id: string }): GeneratorRecipe {
  return {
    name: overrides.id, calories: 500, protein_g: 30, carbs_g: 50, fat_g: 15,
    fiber_g: null, prep_time_min: 10, cook_time_min: 10,
    meal_types: ['lunch'], dietary_patterns: [], allergens: [],
    is_active: true, eligible_for_generator: true, macros_verified: true,
    is_scalable: true, allowed_portions: null,
    ...overrides,
  }
}

describe('mulberry32', () => {
  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(7); const b = mulberry32(7)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})

describe('slotBudgets', () => {
  const target = {
    calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 60,
    calorie_tol_pct: 5, protein_tol_pct: 10, carbs_tol_pct: 15, fat_tol_pct: 15,
  }
  it('splits 30/40/30 without snack', () => {
    const budgets = slotBudgets(target, baseOptions)
    expect(budgets.map(item => item.slot)).toEqual(['breakfast', 'lunch', 'dinner'])
    expect(budgets.map(item => Math.round(item.calories))).toEqual([600, 800, 600])
  })
  it('splits 25/35/10/30 with snack', () => {
    const budgets = slotBudgets(target, { ...baseOptions, includeSnack: true })
    expect(budgets.map(item => item.slot)).toEqual(['breakfast', 'lunch', 'snack', 'dinner'])
    expect(budgets.map(item => Math.round(item.calories))).toEqual([500, 700, 200, 600])
  })
  it('honours a custom distribution', () => {
    const budgets = slotBudgets(target, { ...baseOptions, mealDistribution: { breakfast: 20, lunch: 50, dinner: 30 } })
    expect(budgets.map(item => Math.round(item.calories))).toEqual([400, 1000, 600])
  })
  it('exposes carb and fat budgets per slot', () => {
    const budgets = slotBudgets(target, baseOptions)
    expect(budgets.map(item => Math.round(item.carbs_g))).toEqual([60, 80, 60])
    expect(budgets.map(item => Math.round(item.fat_g))).toEqual([18, 24, 18])
  })
  it('falls back to defaults for a distribution that sums to zero', () => {
    const budgets = slotBudgets(target, { ...baseOptions, mealDistribution: { breakfast: 0, lunch: 0, dinner: 0 } })
    expect(budgets.every(item => [item.calories, item.protein_g, item.carbs_g, item.fat_g].every(Number.isFinite))).toBe(true)
    expect(budgets.map(item => Math.round(item.calories))).toEqual([600, 800, 600])
  })
})

describe('filterPool', () => {
  it('filters by slot, allergens, patterns and prep time', () => {
    const pool = [
      recipe({ id: 'ok', meal_types: ['lunch'] }),
      recipe({ id: 'wrong-slot', meal_types: ['breakfast'] }),
      recipe({ id: 'nuts', allergens: ['nuts'] }),
      recipe({ id: 'not-vegan', dietary_patterns: [] }),
      recipe({ id: 'vegan-ok', dietary_patterns: ['vegan'] }),
      recipe({ id: 'slow', prep_time_min: 40, cook_time_min: 40 }),
    ]
    const options = { ...baseOptions, excludedAllergens: ['nuts'], dietaryPatterns: ['vegan'], maxPrepTimeMin: 30 }
    expect(filterPool(pool, 'lunch', options).map(item => item.id)).toEqual(['vegan-ok'])
  })

  it('hard-excludes recipes the athlete disliked', () => {
    const pool = [recipe({ id: 'liked' }), recipe({ id: 'disliked' })]
    const options = { ...baseOptions, dislikedRecipeIds: ['disliked'] }

    expect(filterPool(pool, 'lunch', options).map(item => item.id)).toEqual(['liked'])
  })

  it('hard-excludes inactive, ineligible, or unverified recipes', () => {
    const pool = [
      recipe({ id: 'ready' }),
      recipe({ id: 'inactive', is_active: false }),
      recipe({ id: 'ineligible', eligible_for_generator: false }),
      recipe({ id: 'unverified', macros_verified: false }),
    ]

    expect(filterPool(pool, 'lunch', baseOptions).map(item => item.id)).toEqual(['ready'])
  })
})

describe('bestPortion', () => {
  it('snaps to allowed_portions', () => {
    const item = recipe({ id: 'fixed', calories: 400, allowed_portions: [0.5, 1, 1.5] })
    expect(bestPortion(item, 650)).toBe(1.5)
  })
  it('scales continuously in 0.25 steps within 0.5–2.0', () => {
    const item = recipe({ id: 'scalable', calories: 400, is_scalable: true, allowed_portions: null })
    expect(bestPortion(item, 700)).toBe(1.75)
    expect(bestPortion(item, 3000)).toBe(2)
    expect(bestPortion(item, 50)).toBe(0.5)
  })
  it('returns 1 for non-scalable recipes', () => {
    const item = recipe({ id: 'rigid', calories: 400, is_scalable: false, allowed_portions: null })
    expect(bestPortion(item, 900)).toBe(1)
  })
})

describe('scoreCandidate', () => {
  const budget = { calories: 600, protein_g: 45, carbs_g: 60, fat_g: 20 }
  it('prefers closer kcal fit', () => {
    const close = scoreCandidate(recipe({ id: 'a', calories: 600, protein_g: 45 }), 1, budget, { usedCount: 0, maxRepeats: 2, isFavourite: false })
    const far = scoreCandidate(recipe({ id: 'b', calories: 300, protein_g: 45 }), 1, budget, { usedCount: 0, maxRepeats: 2, isFavourite: false })
    expect(close).toBeLessThan(far)
  })
  it('hard-excludes beyond max repeats', () => {
    expect(scoreCandidate(recipe({ id: 'c' }), 1, budget, { usedCount: 2, maxRepeats: 2, isFavourite: false })).toBe(Infinity)
  })
  it('gives favourites a bonus and repeats a penalty', () => {
    const plain = scoreCandidate(recipe({ id: 'd', calories: 600, protein_g: 45 }), 1, budget, { usedCount: 0, maxRepeats: 3, isFavourite: false })
    const favourite = scoreCandidate(recipe({ id: 'd', calories: 600, protein_g: 45 }), 1, budget, { usedCount: 0, maxRepeats: 3, isFavourite: true })
    const repeated = scoreCandidate(recipe({ id: 'd', calories: 600, protein_g: 45 }), 1, budget, { usedCount: 1, maxRepeats: 3, isFavourite: false })
    expect(favourite).toBeLessThan(plain)
    expect(repeated).toBeGreaterThan(plain)
  })
  it('prefers candidates closer to the carb budget when calories and protein tie', () => {
    const onTarget = scoreCandidate(recipe({ id: 'balanced', calories: 600, protein_g: 45, carbs_g: 60, fat_g: 20 }), 1, budget, { usedCount: 0, maxRepeats: 2, isFavourite: false })
    const carbHeavy = scoreCandidate(recipe({ id: 'carby', calories: 600, protein_g: 45, carbs_g: 120, fat_g: 20 }), 1, budget, { usedCount: 0, maxRepeats: 2, isFavourite: false })
    expect(onTarget).toBeLessThan(carbHeavy)
  })
  it('prefers candidates closer to the fat budget when calories and protein tie', () => {
    const onTarget = scoreCandidate(recipe({ id: 'balanced', calories: 600, protein_g: 45, carbs_g: 60, fat_g: 20 }), 1, budget, { usedCount: 0, maxRepeats: 2, isFavourite: false })
    const fatty = scoreCandidate(recipe({ id: 'fatty', calories: 600, protein_g: 45, carbs_g: 60, fat_g: 60 }), 1, budget, { usedCount: 0, maxRepeats: 2, isFavourite: false })
    expect(onTarget).toBeLessThan(fatty)
  })
})

function richPool(): GeneratorRecipe[] {
  const pool: GeneratorRecipe[] = []
  const slots: Array<[string, number, number]> = [['breakfast', 450, 30], ['lunch', 700, 45], ['dinner', 550, 40]]
  for (const [slot, kcal, protein] of slots) {
    for (let index = 0; index < 6; index += 1) {
      const calories = kcal + index * 40
      // Carb/fat density matches the 2000 kcal / 200 C / 60 F target (0.1 g C, 0.03 g F per kcal),
      // so a portioned-to-kcal day lands on the carb/fat target rather than hugging the tolerance floor.
      pool.push(recipe({
        id: `${slot}-${index}`, meal_types: [slot],
        calories, protein_g: protein + index * 4,
        carbs_g: calories * 0.1, fat_g: calories * 0.03, is_scalable: true, allowed_portions: null,
      }))
    }
  }
  return pool
}

describe('generateWeek', () => {
  const target = {
    calories: 2000, protein_g: 140, carbs_g: 200, fat_g: 60,
    calorie_tol_pct: KCAL_TOLERANCE * 100,
    protein_tol_pct: 25,
    carbs_tol_pct: 25,
    fat_tol_pct: 25,
  }

  it('produces 7 days x 3 slots within tolerance for a rich pool', () => {
    const plan = generateWeek(richPool(), target, baseOptions)
    expect(plan.days).toHaveLength(7)
    for (const day of plan.days) {
      expect(day.slots).toHaveLength(3)
      expect(Math.abs(day.totals.calories - target.calories) / target.calories).toBeLessThanOrEqual(KCAL_TOLERANCE + 1e-9)
      expect(day.totals.protein_g).toBeGreaterThanOrEqual(target.protein_g * PROTEIN_FLOOR - 1e-9)
    }
    expect(plan.diagnostics.daysOutOfTolerance).toHaveLength(0)
  })

  it('steers days within carb and fat tolerance when the pool mixes balanced and skewed recipes', () => {
    const strictTarget = {
      calories: 2000, protein_g: 140, carbs_g: 200, fat_g: 60,
      calorie_tol_pct: KCAL_TOLERANCE * 100, protein_tol_pct: 25, carbs_tol_pct: 15, fat_tol_pct: 15,
    }
    // Every candidate in a slot ties on kcal + protein, so only carbs/fat separate them.
    // "good" recipes hit the slot carb/fat budget exactly; "skew" recipes blow it far past tolerance.
    const slots: Array<[SlotType, number, number, number, number]> = [
      ['breakfast', 600, 42, 60, 18],
      ['lunch', 800, 56, 80, 24],
      ['dinner', 600, 42, 60, 18],
    ]
    const pool: GeneratorRecipe[] = []
    for (const [slot, kcal, protein, carb, fat] of slots) {
      for (let i = 0; i < 6; i += 1) {
        pool.push(recipe({ id: `${slot}-good-${i}`, meal_types: [slot], calories: kcal, protein_g: protein, carbs_g: carb, fat_g: fat, is_scalable: false }))
        pool.push(recipe({ id: `${slot}-skew-${i}`, meal_types: [slot], calories: kcal, protein_g: protein, carbs_g: carb + 150, fat_g: fat + 50, is_scalable: false }))
      }
    }
    const plan = generateWeek(pool, strictTarget, { ...baseOptions, maxRecipeRepeatsPerWeek: 2 })
    for (const day of plan.days) {
      expect(isWithinTargetTolerances(day.totals, strictTarget)).toBe(true)
    }
    expect(plan.diagnostics.daysOutOfTolerance).toHaveLength(0)
  })

  it('produces a finite score when the calorie target is zero', () => {
    const plan = generateWeek(richPool(), { ...target, calories: 0 }, baseOptions)
    expect(Number.isFinite(plan.score)).toBe(true)
  })

  it('is deterministic for the same seed and differs for another', () => {
    const first = generateWeek(richPool(), target, baseOptions)
    const second = generateWeek(richPool(), target, baseOptions)
    const other = generateWeek(richPool(), target, { ...baseOptions, seed: 43 })
    const key = (plan: typeof first) => plan.days.map(day => day.slots.map(slot => `${slot.recipeId}@${slot.portionMultiplier}`).join('|')).join('//')
    expect(key(first)).toEqual(key(second))
    expect(key(other)).not.toEqual(key(first))
  })

  it('is deterministic for equal-scored recipes regardless of input order', () => {
    const equalPool = ['breakfast', 'lunch', 'dinner'].flatMap(slot => [
      recipe({ id: `${slot}-b`, meal_types: [slot], calories: slot === 'lunch' ? 800 : 600, protein_g: slot === 'lunch' ? 56 : 42 }),
      recipe({ id: `${slot}-a`, meal_types: [slot], calories: slot === 'lunch' ? 800 : 600, protein_g: slot === 'lunch' ? 56 : 42 }),
    ])
    const options = { ...baseOptions, maxRecipeRepeatsPerWeek: 7 }
    const key = (plan: ReturnType<typeof generateWeek>) => plan.days
      .map(day => day.slots.map(slot => `${slot.recipeId}@${slot.portionMultiplier}`).join('|'))
      .join('//')

    expect(key(generateWeek(equalPool, target, options)))
      .toEqual(key(generateWeek([...equalPool].reverse(), target, options)))
  })

  it('respects max repeats per week', () => {
    const plan = generateWeek(richPool(), target, { ...baseOptions, maxRecipeRepeatsPerWeek: 2 })
    const counts = new Map<string, number>()
    for (const day of plan.days) for (const slot of day.slots) counts.set(slot.recipeId, (counts.get(slot.recipeId) ?? 0) + 1)
    for (const count of counts.values()) expect(count).toBeLessThanOrEqual(2)
  })

  it('reports thin pools in diagnostics instead of throwing', () => {
    const tiny = [recipe({ id: 'only-lunch', meal_types: ['lunch'] })]
    const plan = generateWeek(tiny, target, baseOptions)
    expect(plan.diagnostics.poolSizePerSlot.breakfast).toBe(0)
    expect(plan.diagnostics.notes.some(note => note.includes('breakfast'))).toBe(true)
  })

  it('keeps locked slots on regeneration', () => {
    const first = generateWeek(richPool(), target, baseOptions)
    const locked = first.days[0].slots[0]
    const lockedMap = new Map([[`0:${locked.slot}`, { ...locked, locked: true }]])
    const second = generateWeek(richPool(), target, { ...baseOptions, seed: 99 }, lockedMap)
    const kept = second.days[0].slots.find(slot => slot.slot === locked.slot)
    expect(kept?.recipeId).toBe(locked.recipeId)
    expect(kept?.portionMultiplier).toBe(locked.portionMultiplier)
  })

  it('counts locked slots toward the repeat cap before selection', () => {
    const pool = richPool()
    const source = pool.find(item => item.id === 'lunch-0')!
    const locked: GeneratedSlot = {
      slot: 'lunch', recipeId: source.id, recipeName: source.name, portionMultiplier: 1,
      calories: source.calories, protein_g: source.protein_g, carbs_g: source.carbs_g, fat_g: source.fat_g,
      fiber_g: source.fiber_g,
      locked: true,
    }
    const plan = generateWeek(pool, target, { ...baseOptions, maxRecipeRepeatsPerWeek: 1 }, new Map([['6:lunch', locked]]))
    const uses = plan.days.flatMap(day => day.slots).filter(slot => slot.recipeId === 'lunch-0')
    expect(uses).toHaveLength(1)
    expect(plan.days[6].slots.find(slot => slot.slot === 'lunch')?.recipeId).toBe('lunch-0')
  })

  it('restores prior lock flags after temporarily pinning every non-swapped slot', () => {
    const original = generateWeek(richPool(), target, baseOptions)
    const previous = {
      ...original,
      days: original.days.map(day => ({
        ...day,
        slots: day.slots.map(slot => ({
          ...slot,
          locked: day.dayOfWeek === 0 && slot.slot === 'lunch',
        })),
      })),
    }
    const swappedDay = 0
    const swappedSlot = 'breakfast'
    const temporarilyPinned = {
      ...previous,
      days: previous.days.map(day => ({
        ...day,
        slots: day.slots.map(slot => ({
          ...slot,
          locked: !(day.dayOfWeek === swappedDay && slot.slot === swappedSlot),
        })),
      })),
    }

    const restored = restorePinnedSlotLockState(temporarilyPinned, previous, swappedDay, swappedSlot)
    const lockedKeys = restored.days.flatMap(day => day.slots
      .filter(slot => slot.locked)
      .map(slot => `${day.dayOfWeek}:${slot.slot}`))

    expect(lockedKeys).toEqual(['0:lunch'])
    expect(restored.days[0].slots.find(slot => slot.slot === 'breakfast')?.locked).toBe(false)
  })

  it('swaps to a different compatible recipe while preserving every other slot and lock flag', () => {
    const original = generateWeek(richPool(), target, baseOptions)
    const previous = {
      ...original,
      days: original.days.map(day => ({
        ...day,
        slots: day.slots.map(slot => ({
          ...slot,
          locked: day.dayOfWeek === 2 && slot.slot === 'lunch',
        })),
      })),
    }
    const before = previous.days[0].slots.find(slot => slot.slot === 'breakfast')!

    const result = swapGeneratedSlot(richPool(), target, { ...baseOptions, seed: 99 }, previous, 0, 'breakfast')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const after = result.plan.days[0].slots.find(slot => slot.slot === 'breakfast')!
    expect(after.recipeId).not.toBe(before.recipeId)
    expect(after.locked).toBe(false)
    for (const day of previous.days) {
      for (const slot of day.slots) {
        if (day.dayOfWeek === 0 && slot.slot === 'breakfast') continue
        const kept = result.plan.days[day.dayOfWeek].slots.find(candidate => candidate.slot === slot.slot)
        expect(kept).toEqual(slot)
      }
    }
  })

  it('rejects a swap without changing the plan when every other recipe is incompatible', () => {
    const pool = [
      recipe({ id: 'breakfast-current', meal_types: ['breakfast'] }),
      recipe({ id: 'breakfast-disliked', meal_types: ['breakfast'] }),
      recipe({ id: 'lunch-current', meal_types: ['lunch'] }),
      recipe({ id: 'dinner-current', meal_types: ['dinner'] }),
    ]
    const options = { ...baseOptions, maxRecipeRepeatsPerWeek: 0, dislikedRecipeIds: ['breakfast-disliked'] }
    const original = generateWeek(pool, target, options)

    const result = swapGeneratedSlot(pool, target, { ...options, seed: 99 }, original, 0, 'breakfast')

    expect(result).toEqual({ ok: false, reason: 'no-compatible-alternative' })
    expect(original.days[0].slots.find(slot => slot.slot === 'breakfast')?.recipeId).toBe('breakfast-current')
  })
})

describe('adjustDay', () => {
  const looseTarget = { calories: 1000, protein_g: 50, carbs_g: 100, fat_g: 30, calorie_tol_pct: 5, protein_tol_pct: 500, carbs_tol_pct: 500, fat_tol_pct: 500 }
  function builtSlot(r: GeneratorRecipe, slotType: SlotType, portion: number): GeneratedSlot {
    return {
      slot: slotType, recipeId: r.id, recipeName: r.name, portionMultiplier: portion,
      calories: r.calories * portion, protein_g: r.protein_g * portion, carbs_g: r.carbs_g * portion, fat_g: r.fat_g * portion,
      fiber_g: null, locked: false,
    }
  }
  const sumCal = (slots: GeneratedSlot[]) => slots.reduce((sum, item) => sum + item.calories, 0)

  it('re-portions the slot that lands the day closest to target, not merely the largest', () => {
    const big = recipe({ id: 'big', calories: 800, is_scalable: true, allowed_portions: null })
    const small = recipe({ id: 'small', calories: 100, is_scalable: true, allowed_portions: null })
    const slots = [builtSlot(big, 'lunch', 1), builtSlot(small, 'snack', 1)] // 900 kcal, gap 100
    const adjusted = adjustDay(slots, new Map([[big.id, big], [small.id, small]]), looseTarget)
    expect(sumCal(adjusted)).toBe(1000)
    expect(adjusted.find(item => item.slot === 'snack')?.portionMultiplier).toBe(2)
    expect(adjusted.find(item => item.slot === 'lunch')?.portionMultiplier).toBe(1)
  })

  it('iterates across passes to close a gap a single nudge cannot', () => {
    const a = recipe({ id: 'a', calories: 300, is_scalable: true, allowed_portions: null })
    const b = recipe({ id: 'b', calories: 300, is_scalable: true, allowed_portions: null })
    const slots = [builtSlot(a, 'lunch', 1), builtSlot(b, 'dinner', 1)] // 600 kcal, gap 400
    const adjusted = adjustDay(slots, new Map([[a.id, a], [b.id, b]]), looseTarget)
    expect(Math.abs(sumCal(adjusted) - looseTarget.calories) / looseTarget.calories).toBeLessThanOrEqual(looseTarget.calorie_tol_pct / 100 + 1e-9)
  })

  it('leaves a day already within tolerance untouched', () => {
    const only = recipe({ id: 'only', calories: 1000, is_scalable: true, allowed_portions: null })
    const slots = [builtSlot(only, 'lunch', 1)]
    const adjusted = adjustDay(slots, new Map([[only.id, only]]), looseTarget)
    expect(adjusted[0].portionMultiplier).toBe(1)
  })
})

describe('isWithinTargetTolerances', () => {
  const target = {
    calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 60,
    calorie_tol_pct: 5, protein_tol_pct: 10, carbs_tol_pct: 15, fat_tol_pct: 15,
  }

  it('rejects carb and fat violations even when calories and protein pass', () => {
    expect(isWithinTargetTolerances(
      { calories: 2000, protein_g: 150, carbs_g: 240, fat_g: 75 },
      target,
    )).toBe(false)
  })

  it('honours custom symmetric tolerances and handles zero targets safely', () => {
    expect(isWithinTargetTolerances(
      { calories: 2100, protein_g: 165, carbs_g: 240, fat_g: 72 },
      { ...target, calorie_tol_pct: 5, protein_tol_pct: 10, carbs_tol_pct: 20, fat_tol_pct: 20 },
    )).toBe(true)
    expect(isWithinTargetTolerances(
      { calories: 2000, protein_g: 1, carbs_g: 200, fat_g: 60 },
      { ...target, protein_g: 0, protein_tol_pct: 100 },
    )).toBe(false)
  })
})
