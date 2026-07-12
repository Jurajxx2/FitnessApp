import { describe, it, expect } from 'vitest'
import { classifyExistingMeals } from './MealPlanEditor'

describe('classifyExistingMeals', () => {
  it('recognizes snack as a first-class managed meal type (snack round-trip)', () => {
    const { managed } = classifyExistingMeals([
      { id: 'm1', name: 'Snack', day_of_week: 2 },
      { id: 'm2', name: 'BREAKFAST', day_of_week: 0 },
    ])
    const snack = managed.find(m => m.id === 'm1')
    expect(snack?.meal_type).toBe('snack')
    expect(snack?.dayIdx).toBe(2)
    expect(managed.find(m => m.id === 'm2')?.meal_type).toBe('breakfast')
  })

  it('preserves ids of meals the editor cannot render (unknown type or invalid day) so save never destroys them', () => {
    const { managed, unmanagedMealIds } = classifyExistingMeals([
      { id: 'm1', name: 'Snack', day_of_week: 1 },
      { id: 'm2', name: 'Brunch', day_of_week: 1 },   // unknown meal type
      { id: 'm3', name: 'Dinner', day_of_week: 99 },  // recognized type, out-of-range day
      { id: 'm4', name: 'Second Lunch', day_of_week: null },
    ])
    expect(managed.map(m => m.id)).toEqual(['m1'])
    expect(unmanagedMealIds).toEqual(['m2', 'm3', 'm4'])
  })

  it('returns nothing to preserve when every meal is managed', () => {
    const { unmanagedMealIds } = classifyExistingMeals([
      { id: 'm1', name: 'Lunch', day_of_week: 3 },
      { id: 'm2', name: 'Dinner', day_of_week: 3 },
    ])
    expect(unmanagedMealIds).toEqual([])
  })
})
