import { describe, expect, it } from 'vitest'
import {
  bestPortion, filterPool, generateWeek, KCAL_TOLERANCE, mulberry32, PROTEIN_FLOOR, scoreCandidate, slotBudgets,
  type GeneratorOptions, type GeneratorRecipe,
} from './generator'

export const baseOptions: GeneratorOptions = {
  includeSnack: false, mealDistribution: null, dietaryPatterns: [], excludedAllergens: [],
  maxPrepTimeMin: null, maxRecipeRepeatsPerWeek: 2, favouriteRecipeIds: [], seed: 42,
}

export function recipe(overrides: Partial<GeneratorRecipe> & { id: string }): GeneratorRecipe {
  return {
    name: overrides.id, calories: 500, protein_g: 30, carbs_g: 50, fat_g: 15,
    fiber_g: null, prep_time_min: 10, cook_time_min: 10,
    meal_types: ['lunch'], dietary_patterns: [], allergens: [],
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
  const target = { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 60 }
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
  const budget = { calories: 600, protein_g: 45 }
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
})

function richPool(): GeneratorRecipe[] {
  const pool: GeneratorRecipe[] = []
  const slots: Array<[string, number, number]> = [['breakfast', 450, 30], ['lunch', 700, 45], ['dinner', 550, 40]]
  for (const [slot, kcal, protein] of slots) {
    for (let index = 0; index < 6; index += 1) {
      pool.push(recipe({
        id: `${slot}-${index}`, meal_types: [slot],
        calories: kcal + index * 40, protein_g: protein + index * 4,
        carbs_g: 50, fat_g: 15, is_scalable: true, allowed_portions: null,
      }))
    }
  }
  return pool
}

describe('generateWeek', () => {
  const target = { calories: 2000, protein_g: 140, carbs_g: 200, fat_g: 60 }

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

  it('is deterministic for the same seed and differs for another', () => {
    const first = generateWeek(richPool(), target, baseOptions)
    const second = generateWeek(richPool(), target, baseOptions)
    const other = generateWeek(richPool(), target, { ...baseOptions, seed: 43 })
    const key = (plan: typeof first) => plan.days.map(day => day.slots.map(slot => `${slot.recipeId}@${slot.portionMultiplier}`).join('|')).join('//')
    expect(key(first)).toEqual(key(second))
    expect(key(other)).not.toEqual(key(first))
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
})
