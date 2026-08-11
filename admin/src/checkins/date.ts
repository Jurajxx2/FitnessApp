export const CHECK_IN_TIME_ZONE = 'Europe/Prague'

/** Monday of the coach's Prague calendar week, matching KMP and Storage RLS. */
export function currentWeekMondayIso(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CHECK_IN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value)
  const pragueDate = new Date(Date.UTC(value('year'), value('month') - 1, value('day')))
  const daysSinceMonday = (pragueDate.getUTCDay() + 6) % 7
  pragueDate.setUTCDate(pragueDate.getUTCDate() - daysSinceMonday)
  return pragueDate.toISOString().slice(0, 10)
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
