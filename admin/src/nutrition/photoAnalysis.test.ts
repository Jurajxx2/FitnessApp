import { describe, expect, it } from 'vitest'
import { mergeAnalysis } from './photoAnalysis'
import { draftFromFood, emptyIngredient } from '../pages/nutrition/LogMeal'

describe('mergeAnalysis', () => {
  const analysis = {
    mealName: 'Kuracie s ryžou',
    foods: [{ name: 'Kuracie prsia', amount: 150, unit: 'g', calories: 247, protein_g: 46, carbs_g: 0, fat_g: 5 }],
  }

  it('replaces a single empty starter row', () => {
    const merged = mergeAnalysis([emptyIngredient()], analysis)

    expect(merged).toHaveLength(1)
    expect(merged[0].name).toBe('Kuracie prsia')
  })

  it('appends after user-entered rows without touching them', () => {
    const existing = [draftFromFood({ name: 'Ryža', amount: 100, unit: 'g', calories: 130, protein_g: 3, carbs_g: 28, fat_g: 0 })]
    const merged = mergeAnalysis(existing, analysis)

    expect(merged.map(item => item.name)).toEqual(['Ryža', 'Kuracie prsia'])
    expect(merged[0]).toBe(existing[0])
  })
})
