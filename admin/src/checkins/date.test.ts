import { describe, expect, it } from 'vitest'
import { currentWeekMondayIso } from './date'

describe('currentWeekMondayIso', () => {
  it('uses the Prague Monday boundary across the spring DST transition', () => {
    expect(currentWeekMondayIso(new Date('2026-03-29T21:30:00Z'))).toBe('2026-03-23')
    expect(currentWeekMondayIso(new Date('2026-03-29T22:30:00Z'))).toBe('2026-03-30')
  })

  it('uses the Prague Monday boundary after the autumn DST transition', () => {
    expect(currentWeekMondayIso(new Date('2026-10-25T22:30:00Z'))).toBe('2026-10-19')
    expect(currentWeekMondayIso(new Date('2026-10-25T23:30:00Z'))).toBe('2026-10-26')
  })
})
