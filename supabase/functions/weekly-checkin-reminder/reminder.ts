/** Monday (UTC) of the week containing `date`, as ISO YYYY-MM-DD. */
export function mondayOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day // shift back to Monday
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

/** Trainee ids that have NOT checked in this week. */
export function usersNeedingReminder(
  allTrainees: { id: string }[],
  checkedInUserIds: Set<string>,
): string[] {
  return allTrainees.filter((t) => !checkedInUserIds.has(t.id)).map((t) => t.id)
}
