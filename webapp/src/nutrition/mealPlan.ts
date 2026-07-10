import type { MealRow } from '../types/database'

export function mealsForDay(meals: MealRow[], day: number): MealRow[] {
  return meals
    .filter(mm => mm.day_of_week === day || mm.day_of_week == null)
    .sort((a, b) => a.sort_order - b.sort_order)
}

/** JS getDay(): 0=Sun..6=Sat → app convention 0=Mon..6=Sun. */
export function todayDowMon0(): number {
  const js = new Date().getDay()
  return (js + 6) % 7
}
