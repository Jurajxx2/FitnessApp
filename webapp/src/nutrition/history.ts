import type { MealLogRow } from '../types/database'

export function groupByDay(logs: MealLogRow[]): Array<{ date: string; logs: MealLogRow[] }> {
  const logsByDay = new Map<string, MealLogRow[]>()

  for (const log of logs) {
    const day = log.logged_at.slice(0, 10)
    const dayLogs = logsByDay.get(day) ?? []
    dayLogs.push(log)
    logsByDay.set(day, dayLogs)
  }

  return [...logsByDay.entries()]
    .sort(([firstDate], [secondDate]) => secondDate.localeCompare(firstDate))
    .map(([date, dayLogs]) => ({ date, logs: dayLogs }))
}
