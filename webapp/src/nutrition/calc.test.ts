import { scaleFood, sumMacros, calcMacroTargets } from './calc'
import type { FoodRow } from '../types/database'

const chicken: FoodRow = {
  id: '1', name: 'Chicken breast', calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6,
  serving_size: 100, serving_unit: 'g', brand: null, is_verified: true,
}

test('scaleFood scales macros linearly by amount / serving_size', () => {
  const r = scaleFood(chicken, 200)
  expect(r.calories).toBeCloseTo(330)
  expect(r.protein_g).toBeCloseTo(62)
  expect(r.amount).toBe(200)
  expect(r.unit).toBe('g')
  expect(r.name).toBe('Chicken breast')
})

test('scaleFood with zero serving_size does not divide by zero', () => {
  const r = scaleFood({ ...chicken, serving_size: 0 }, 200)
  expect(r.calories).toBe(0)
})

test('sumMacros totals a list', () => {
  const total = sumMacros([
    { calories: 100, protein_g: 10, carbs_g: 5, fat_g: 2 },
    { calories: 250, protein_g: 5, carbs_g: 30, fat_g: 8 },
  ])
  expect(total).toEqual({ calories: 350, protein_g: 15, carbs_g: 35, fat_g: 10 })
})

test('calcMacroTargets: Mifflin–St Jeor, 1.8g/kg protein, 25% fat, carbs remainder', () => {
  // 80kg, 180cm, 30y, moderately_active, build_muscle
  // bmr = 10*80 + 6.25*180 - 5*30 + 5 = 1780
  // tdee = 1780 * 1.55 = 2759 ; kcal = 2759 * 1.10 = 3034.9
  const t = calcMacroTargets({ weight_kg: 80, height_cm: 180, age: 30, activity_level: 'moderately_active', goal: 'build_muscle' })!
  expect(t.calories).toBeCloseTo(3034.9, 0)
  expect(t.protein_g).toBeCloseTo(144)      // 80 * 1.8
  expect(t.fat_g).toBeCloseTo(3034.9 * 0.25 / 9, 1)
  expect(t.carbs_g).toBeGreaterThan(0)
})

test('calcMacroTargets returns null when any input missing', () => {
  expect(calcMacroTargets({ weight_kg: null, height_cm: 180, age: 30, activity_level: 'active', goal: 'stay_fit' })).toBeNull()
})
