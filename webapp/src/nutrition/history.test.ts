import { groupByDay } from './history'
import type { MealLogRow } from '../types/database'

const log = (id: string, iso: string): MealLogRow => ({
  id,
  user_id: 'u',
  meal_name: id,
  notes: null,
  image_url: null,
  logged_at: iso,
  meal_log_foods: [],
})

test('groups logs by calendar day, newest first', () => {
  const groups = groupByDay([
    log('a', '2026-07-10T09:00:00Z'),
    log('b', '2026-07-10T19:00:00Z'),
    log('c', '2026-07-09T12:00:00Z'),
  ])

  expect(groups.map((group) => group.date)).toEqual(['2026-07-10', '2026-07-09'])
  expect(groups[0].logs.map((entry) => entry.id)).toEqual(['a', 'b'])
})
