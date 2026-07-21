import { describe, it, expect } from 'vitest'
import { exerciseHasData, findBlankNamedExerciseRows, describeInvalidExerciseRows } from './Workouts'

const blank = { client_id: 'draft-1', exercise_id: null, name: '', muscle_group: '', sets: 3, reps: '10', rest_seconds: 60, tips: '', sort_order: 0, image_url: null, image_url_2: null }

describe('workout exercise-row validation', () => {
  it('treats a pristine default row as empty (safe to drop silently)', () => {
    expect(exerciseHasData({ ...blank })).toBe(false)
  })

  it('treats a row with a muscle group, tips, exercise id, or changed set/rep/rest as having data', () => {
    expect(exerciseHasData({ ...blank, muscle_group: 'Chest' })).toBe(true)
    expect(exerciseHasData({ ...blank, tips: 'keep elbows tucked' })).toBe(true)
    expect(exerciseHasData({ ...blank, exercise_id: 'ex-1' })).toBe(true)
    expect(exerciseHasData({ ...blank, sets: 5 })).toBe(true)
    expect(exerciseHasData({ ...blank, reps: '8-12' })).toBe(true)
    expect(exerciseHasData({ ...blank, rest_seconds: 90 })).toBe(true)
  })

  it('flags rows that carry data but have no name, so the save is blocked instead of dropping them', () => {
    const exercises = [
      { ...blank, name: 'Bench Press', muscle_group: 'Chest' }, // valid
      { ...blank, muscle_group: 'Back' },                       // data, no name -> invalid
      { ...blank },                                             // pristine empty -> ignored
    ]
    expect(findBlankNamedExerciseRows(exercises)).toEqual([1])
  })

  it('does not flag entirely empty rows or fully named rows', () => {
    const exercises = [
      { ...blank, name: 'Squat', sets: 5 },
      { ...blank },
    ]
    expect(findBlankNamedExerciseRows(exercises)).toEqual([])
  })

  it('describes the offending rows with a coach-facing 1-based message', () => {
    expect(describeInvalidExerciseRows([1])).toMatch(/Exercise 2 has details but no exercise name/)
    expect(describeInvalidExerciseRows([1, 3])).toMatch(/Exercises 2, 4 have details but no exercise name/)
    expect(describeInvalidExerciseRows([])).toBe('')
  })
})
