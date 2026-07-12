import { toLocalDateIso, todayIso } from './date'

// These tests are timezone-INDEPENDENT: Dates are built from LOCAL wall-clock
// components (new Date(y, m, d, ...)), and toLocalDateIso reads them back with
// the local getters, so the machine's timezone never changes the result.

test('formats a Date to its LOCAL YYYY-MM-DD', () => {
  const d = new Date(2026, 6, 12, 23, 30) // 2026-07-12 23:30 local
  expect(toLocalDateIso(d)).toBe('2026-07-12')
})

test('zero-pads month and day', () => {
  const d = new Date(2026, 0, 5, 8, 0) // 2026-01-05 local
  expect(toLocalDateIso(d)).toBe('2026-01-05')
})

test('uses the local calendar day near midnight (not the UTC day)', () => {
  const justAfterMidnight = new Date(2026, 6, 12, 0, 15) // 00:15 local on the 12th
  const justBeforeMidnight = new Date(2026, 6, 12, 23, 45) // 23:45 local on the 12th
  expect(toLocalDateIso(justAfterMidnight)).toBe('2026-07-12')
  expect(toLocalDateIso(justBeforeMidnight)).toBe('2026-07-12')
})

test('todayIso returns the local calendar day of "now"', () => {
  expect(todayIso()).toBe(toLocalDateIso(new Date()))
})
