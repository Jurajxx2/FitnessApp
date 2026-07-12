import { describe, it, expect } from 'vitest'
import { parseRecipeImport, parseMealPlanImport } from './importers'

describe('parseRecipeImport', () => {
  it('parses a valid recipe row', () => {
    const result = parseRecipeImport([
      {
        external_id: 'r1',
        name: 'Recipe One',
        ingredients: [
          { name: 'Flour', calories: 100, protein_g: 1, carbs_g: 20, fat_g: 0 },
        ],
      },
    ])
    expect(result.ok).toBe(true)
  })

  it('returns a validation error instead of throwing when an ingredient is null', () => {
    const json = [
      {
        external_id: 'r1',
        name: 'Recipe One',
        ingredients: [null],
      },
    ]

    expect(() => parseRecipeImport(json)).not.toThrow()

    const result = parseRecipeImport(json)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ row: 0, field: 'ingredients[0]' }),
      )
    }
  })

  it('returns a validation error instead of throwing when an ingredient is a primitive', () => {
    const json = [
      {
        external_id: 'r1',
        name: 'Recipe One',
        ingredients: ['not-an-object'],
      },
    ]

    expect(() => parseRecipeImport(json)).not.toThrow()

    const result = parseRecipeImport(json)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ row: 0, field: 'ingredients[0]' }),
      )
    }
  })
})

describe('parseMealPlanImport', () => {
  it('parses a valid meal plan row', () => {
    const result = parseMealPlanImport([
      {
        name: 'Plan One',
        meals: [{ name: 'Breakfast', recipes: [{ external_id: 'r1' }] }],
      },
    ])
    expect(result.ok).toBe(true)
  })

  it('returns a validation error instead of throwing when a meal is null', () => {
    const json = [
      {
        name: 'Plan One',
        meals: [null],
      },
    ]

    expect(() => parseMealPlanImport(json)).not.toThrow()

    const result = parseMealPlanImport(json)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ row: 0, field: 'meals[0]' }),
      )
    }
  })

  it('returns a validation error instead of throwing when a recipe reference is null', () => {
    const json = [
      {
        name: 'Plan One',
        meals: [{ name: 'Breakfast', recipes: [null] }],
      },
    ]

    expect(() => parseMealPlanImport(json)).not.toThrow()

    const result = parseMealPlanImport(json)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ row: 0, field: 'meals[0].recipes[0]' }),
      )
    }
  })
})
