import { describe, expect, it } from 'vitest'
import { athleteBackTarget } from './AthleteAppShell'

describe('athleteBackTarget', () => {
  it('returns the activity hub for activity subsections', () => {
    expect(athleteBackTarget('/activity/history')).toBe('/activity')
    expect(athleteBackTarget('/activity/session')).toBe('/activity')
  })

  it('returns the parent list for deep activity details', () => {
    expect(athleteBackTarget('/activity/workouts/workout-1')).toBe('/activity/workouts')
    expect(athleteBackTarget('/activity/exercises/exercise-1')).toBe('/activity/exercises')
  })

  it('does not add a back action to a top-level section', () => {
    expect(athleteBackTarget('/activity')).toBeNull()
    expect(athleteBackTarget('/messages')).toBeNull()
  })
})
