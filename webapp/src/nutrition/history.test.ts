import { groupByDay } from './history'
import type { MealLogRow } from '../types/database'

// Build `logged_at` from LOCAL wall-clock components so the assertions are
// independent of the machine's timezone: groupByDay buckets by the LOCAL day,
// and a local Date round-tripped through toISOString() preserves its local day.
const localIso = (year: number, monthIndex: number, day: number, hour: number) =>
  new Date(year, monthIndex, day, hour).toISOString()

const log = (id: string, iso: string): MealLogRow => ({
  id,
  user_id: 'u',
  meal_name: id,
  notes: null,
  image_url: null,
  logged_at: iso,
  meal_log_foods: [],
})

test('groups logs by LOCAL calendar day, newest first', () => {
  const groups = groupByDay([
    log('a', localIso(2026, 6, 10, 9)),
    log('b', localIso(2026, 6, 10, 19)),
    log('c', localIso(2026, 6, 9, 12)),
  ])

  expect(groups.map((group) => group.date)).toEqual(['2026-07-10', '2026-07-09'])
  expect(groups[0].logs.map((entry) => entry.id)).toEqual(['a', 'b'])
})

test('a late-evening local meal groups under its local day', () => {
  // 23:00 local on the 10th belongs to the 10th even though it may be the 11th in UTC.
  const groups = groupByDay([log('late', localIso(2026, 6, 10, 23))])
  expect(groups.map((group) => group.date)).toEqual(['2026-07-10'])
})
