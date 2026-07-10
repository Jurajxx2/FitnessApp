import { mealsForDay, todayDowMon0 } from './mealPlan'
import type { MealRow } from '../types/database'

const m = (id: string, day: number | null, sort = 0): MealRow => ({
  id, meal_plan_id: 'p', name: id, time_of_day: null, sort_order: sort, day_of_week: day, meal_foods: [],
})

test('keeps meals for the given day plus every-day (null) meals, sorted', () => {
  const meals = [m('a', 2, 1), m('b', null, 0), m('c', 3, 0)]
  expect(mealsForDay(meals, 2).map(x => x.id)).toEqual(['b', 'a'])
})

test('todayDowMon0 returns 0..6', () => {
  const d = todayDowMon0()
  expect(d).toBeGreaterThanOrEqual(0)
  expect(d).toBeLessThanOrEqual(6)
})
