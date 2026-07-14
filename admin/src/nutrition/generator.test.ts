import { describe, expect, it } from 'vitest'
import { bestPortion, filterPool, mulberry32, scoreCandidate, slotBudgets, type GeneratorOptions, type GeneratorRecipe } from './generator'

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
