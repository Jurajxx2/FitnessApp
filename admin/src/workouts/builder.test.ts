import { describe, expect, it } from 'vitest'
import { estimateWorkoutDuration, moveItem } from './builder'

describe('workout builder utilities', () => {
  it('returns no estimate until the workout has an exercise', () => {
    expect(estimateWorkoutDuration([])).toBe(0)
  })

  it('estimates from sets, work, rests, transitions, and warmup then rounds up to five minutes', () => {
    const exercises = Array.from({ length: 6 }, () => ({ sets: 3, reps: '10', rest_seconds: 60 }))
    expect(estimateWorkoutDuration(exercises)).toBe(40)
  })

  it('understands timed sets instead of treating their number as repetitions', () => {
    expect(estimateWorkoutDuration([{ sets: 3, reps: '60 seconds', rest_seconds: 60 }])).toBe(10)
    expect(estimateWorkoutDuration([{ sets: 3, reps: '2 min', rest_seconds: 60 }])).toBe(15)
  })

  it('moves an item without mutating the input', () => {
    const original = ['a', 'b', 'c']
    expect(moveItem(original, 0, 2)).toEqual(['b', 'c', 'a'])
    expect(original).toEqual(['a', 'b', 'c'])
  })

  it('ignores invalid move targets', () => {
    const original = ['a', 'b']
    expect(moveItem(original, -1, 1)).toBe(original)
    expect(moveItem(original, 0, 4)).toBe(original)
  })
})
