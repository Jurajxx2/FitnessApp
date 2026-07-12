import { toLocalDateIso } from '../nutrition/date'

/** Monday of the current local calendar week, matching the mobile app. */
export function currentWeekMondayIso(date = new Date()): string {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const daysSinceMonday = (monday.getDay() + 6) % 7
  monday.setDate(monday.getDate() - daysSinceMonday)
  return toLocalDateIso(monday)
}

export function formatCheckInWeek(weekOf: string): string {
  const [year, month, day] = weekOf.split('-').map(Number)
  return new Intl.DateTimeFormat('sk-SK', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

export function formatResponseDate(value: string): string {
  return new Intl.DateTimeFormat('sk-SK', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}
