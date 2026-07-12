import type { MealLogRow } from '../types/database'
import { toLocalDateIso } from './date'

export function groupByDay(logs: MealLogRow[]): Array<{ date: string; logs: MealLogRow[] }> {
  const logsByDay = new Map<string, MealLogRow[]>()

  for (const log of logs) {
    // `logged_at` is stored as UTC; bucket by its LOCAL calendar day so meals
    // near midnight group under the day they are displayed with locally.
    const day = toLocalDateIso(new Date(log.logged_at))
    const dayLogs = logsByDay.get(day) ?? []
    dayLogs.push(log)
    logsByDay.set(day, dayLogs)
  }

  return [...logsByDay.entries()]
    .sort(([firstDate], [secondDate]) => secondDate.localeCompare(firstDate))
    .map(([date, dayLogs]) => ({ date, logs: dayLogs }))
}
