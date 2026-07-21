import { describe, expect, it } from 'vitest'
import type { MealLogRow, RecipeRow } from '../types/database'
import type { MealDraft } from './logDraft'
import {
  amountGrams,
  dedupeRecentEntries,
  draftFromFood,
  isoToLocalDateTime,
  isUntouchedEmptyIngredient,
  localDateTimeToIso,
  recipeIngredientsToDrafts,
  rescaleDraftAmount,
  suggestMealName,
  validateMealDraft,
} from './logDraft'

function recipe(overrides: Partial<RecipeRow> = {}): RecipeRow {
  return {
    id: 'recipe-1', name: 'Ryžová miska', description: null, calories: 600,
    protein_g: 40, carbs_g: 70, fat_g: 15, photo_url: null, prep_time_min: null,
    cook_time_min: null, servings: 4, difficulty: null, tags: [], featured: false,
    is_active: true,
    recipe_ingredients: [{
      id: 'ingredient-1', recipe_id: 'recipe-1', name: 'Ryža', quantity: 800,
      unit: 'g', calories: 1200, protein_g: 24, carbs_g: 280, fat_g: 4, sort_order: 0,
    }],
    ...overrides,
  }
}

describe('recipeIngredientsToDrafts', () => {
  it('scales whole-recipe ingredients for fractional servings', () => {
    const [rice] = recipeIngredientsToDrafts(recipe(), 1.5)
    expect(rice).toMatchObject({
      name: 'Ryža', amount: 300, calories: 450, protein_g: 9, carbs_g: 105, fat_g: 1.5,
    })
  })

  it('uses per-serving recipe macros when ingredients are unavailable', () => {
    const [fallback] = recipeIngredientsToDrafts(recipe({ recipe_ingredients: [] }), 0.5)
    expect(fallback).toMatchObject({
      amount: 0.5, unit: 'porcia', calories: 300, protein_g: 20, carbs_g: 35, fat_g: 7.5,
    })
  })

  it('rejects non-positive and non-finite servings', () => {
    expect(recipeIngredientsToDrafts(recipe(), 0)).toEqual([])
    expect(recipeIngredientsToDrafts(recipe(), Number.NaN)).toEqual([])
  })
})

describe('log draft helpers', () => {
  const entry = draftFromFood({
    name: 'Ryža', amount: 100, unit: 'g', calories: 130, protein_g: 3, carbs_g: 28, fat_g: 1,
  }, 'manual')
  const valid: MealDraft = {
    mealName: 'Obed', mealType: 'lunch', loggedAt: '2026-07-20T10:30:00.000Z', notes: '', entries: [entry],
  }

  it('rescales nutrition with an edited amount', () => {
    expect(rescaleDraftAmount(entry, 250)).toMatchObject({
      calories: 325, protein_g: 7.5, carbs_g: 70, fat_g: 2.5,
    })
  })

  it('rejects blank names, invalid instants, and negative or non-finite nutrition', () => {
    const result = validateMealDraft({
      ...valid, mealName: ' ', loggedAt: 'not-a-date',
      entries: [{ ...entry, calories: Number.NaN, fat_g: -1 }],
    })
    expect(result.valid).toBe(false)
    expect(result.mealName).toBe('required')
    expect(result.mealType).toBeNull()
    expect(result.loggedAt).toBe('invalid')
    expect(result.entries[0].fields).toEqual(['calories', 'fat_g'])
  })

  it('requires a meal type for new logging drafts', () => {
    const result = validateMealDraft({ ...valid, mealType: null })
    expect(result.valid).toBe(false)
    expect(result.mealType).toBe('required')
  })

  it('only persists gram amounts in amount_grams', () => {
    expect(amountGrams(120, ' g ')).toBe(120)
    expect(amountGrams(2, 'ks')).toBeNull()
    expect(amountGrams(null, null)).toBeNull()
  })

  it('accepts an entry without a portion but rejects a half-filled portion', () => {
    const base = {
      mealName: 'Obed', mealType: 'lunch' as const, loggedAt: '2026-07-20T12:00:00.000Z', notes: '',
    }
    const withoutPortion = draftFromFood({
      name: 'Polievka', amount: null, unit: null, calories: 180, protein_g: 8, carbs_g: 20, fat_g: 7,
    })
    expect(validateMealDraft({ ...base, entries: [withoutPortion] }).valid).toBe(true)
    expect(validateMealDraft({ ...base, entries: [{ ...withoutPortion, unit: 'g' }] }).valid).toBe(false)
  })

  it('distinguishes a pristine blank row from partially entered unnamed data', () => {
    const blank = draftFromFood({ name: '', amount: 100, unit: 'g', calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })
    expect(isUntouchedEmptyIngredient(blank)).toBe(true)
    expect(isUntouchedEmptyIngredient({ ...blank, calories: 50 })).toBe(false)
    expect(isUntouchedEmptyIngredient({ ...blank, amount: 200 })).toBe(false)
  })

  it('converts a valid local calendar value and rejects rollover dates', () => {
    expect(localDateTimeToIso('2026-02-30', '10:15')).toBeNull()
    const iso = localDateTimeToIso('2026-07-20', '10:15')
    expect(iso).not.toBeNull()
    expect(new Date(iso!).getHours()).toBe(10)
    expect(new Date(iso!).getMinutes()).toBe(15)
    expect(isoToLocalDateTime(iso!)).toEqual({ date: '2026-07-20', time: '10:15' })
    expect(isoToLocalDateTime('invalid')).toBeNull()
  })
})

describe('dedupeRecentEntries', () => {
  function log(id: string, loggedAt: string, amount: number): MealLogRow {
    return {
      id, user_id: 'user-1', meal_name: 'Jedlo', meal_type: null, notes: null, image_url: null,
      logged_at: loggedAt,
      meal_log_foods: [{
        id: `${id}-food`, meal_log_id: id, name: ' Ryža ', amount, unit: 'G', amount_grams: amount,
        calories: amount, protein_g: 0, carbs_g: 0, fat_g: 0,
      }],
    }
  }

  it('keeps the latest snapshot for a normalized food and bounds the result', () => {
    const result = dedupeRecentEntries([
      log('old', '2026-07-19T10:00:00Z', 100), log('new', '2026-07-20T10:00:00Z', 250),
    ], 1)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ amount: 250, source: 'recent' })
  })
})

describe('suggestMealName', () => {
  it('returns empty string for empty list', () => {
    expect(suggestMealName([])).toBe('')
  })

  it('returns the single name for a one-item list', () => {
    expect(suggestMealName(['Ryža'])).toBe('Ryža')
  })

  it('joins two items with " a " for two-item lists', () => {
    expect(suggestMealName(['Kuracie mäso', 'Ryža'])).toBe('Kuracie mäso a Ryža')
  })

  it('shows first two and "ďalšie" for lists with 3+ items', () => {
    expect(suggestMealName(['A', 'B', 'C'])).toBe('A, B a ďalšie')
  })

  it('filters out whitespace-only and empty names before counting', () => {
    expect(suggestMealName(['   ', 'Ryža', ''])).toBe('Ryža')
  })

  it('trims leading and trailing spaces from each name', () => {
    expect(suggestMealName(['  Kuracie ', ' Ryža '])).toBe('Kuracie a Ryža')
  })
})
