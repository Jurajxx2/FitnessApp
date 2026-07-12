/** Formats a Date to its LOCAL calendar day as YYYY-MM-DD.
 *  Uses local year/month/day (not toISOString(), which is UTC) so a meal's
 *  bucketing day matches the local time it is displayed with. */
export function toLocalDateIso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayIso(): string {
  return toLocalDateIso(new Date())
}
