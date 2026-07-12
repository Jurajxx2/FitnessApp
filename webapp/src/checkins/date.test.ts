import { currentWeekMondayIso } from './date'

describe('currentWeekMondayIso', () => {
  it.each([
    ['2026-07-06T10:00:00', '2026-07-06'],
    ['2026-07-08T10:00:00', '2026-07-06'],
    ['2026-07-12T10:00:00', '2026-07-06'],
  ])('maps %s to the local Monday %s', (input, expected) => {
    expect(currentWeekMondayIso(new Date(input))).toBe(expected)
  })
})
