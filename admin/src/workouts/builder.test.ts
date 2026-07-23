import { describe, expect, it } from 'vitest'
import {
  applyLogTypeChange,
  clampTargetDuration,
  estimateWorkoutDuration,
  formatSeconds,
  inferWorkoutExerciseLogType,
  moveItem,
  normalizedTargetDurationSeconds
} from './builder'

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

describe('clampTargetDuration', () => {
  it('clamps to the [1, 3600] range and rounds', () => {
    expect(clampTargetDuration(0)).toBe(1)
    expect(clampTargetDuration(-5)).toBe(1)
    expect(clampTargetDuration(999999)).toBe(3600)
    expect(clampTargetDuration(90)).toBe(90)
    expect(clampTargetDuration(Number.NaN)).toBe(1)
  })
})

describe('normalizedTargetDurationSeconds', () => {
  // Write-time guard mirroring the mobile WorkoutRepositoryImpl.normalizedTargetDurationSeconds:
  // time => a non-null target in [1,3600] (default 30); every other log_type => null.
  it('defaults, clamps, and rounds a TIME target', () => {
    expect(normalizedTargetDurationSeconds('time', null)).toBe(30)
    expect(normalizedTargetDurationSeconds('time', undefined)).toBe(30)
    expect(normalizedTargetDurationSeconds('time', 90)).toBe(90)
    expect(normalizedTargetDurationSeconds('time', 0)).toBe(1)
    expect(normalizedTargetDurationSeconds('time', -5)).toBe(1)
    expect(normalizedTargetDurationSeconds('time', 999999)).toBe(3600)
  })

  it('nulls the target for every non-time log_type', () => {
    expect(normalizedTargetDurationSeconds('weight_reps', 45)).toBeNull()
    expect(normalizedTargetDurationSeconds('bodyweight_reps', 45)).toBeNull()
    expect(normalizedTargetDurationSeconds(null, 45)).toBeNull()
    expect(normalizedTargetDurationSeconds(undefined, 45)).toBeNull()
  })
})

describe('formatSeconds', () => {
  it('formats total seconds as m:ss', () => {
    expect(formatSeconds(90)).toBe('1:30')
    expect(formatSeconds(45)).toBe('0:45')
    expect(formatSeconds(605)).toBe('10:05')
    expect(formatSeconds(0)).toBe('0:00')
    expect(formatSeconds(-3)).toBe('0:00')
  })
})

describe('applyLogTypeChange', () => {
  const base = { sets: 3, reps: '10', rest_seconds: 60 }

  it('seeds the default target when switching into time from weight_reps', () => {
    const exercise = { ...base, log_type: 'weight_reps' as const, target_duration_seconds: null }
    const result = applyLogTypeChange(exercise, 'time')
    expect(result.log_type).toBe('time')
    expect(result.target_duration_seconds).toBe(30)
  })

  it('keeps an existing target when staying on time', () => {
    const exercise = { ...base, log_type: 'time' as const, target_duration_seconds: 45 }
    const result = applyLogTypeChange(exercise, 'time')
    expect(result.target_duration_seconds).toBe(45)
  })

  it('clamps an out-of-range target when staying on time', () => {
    const exercise = { ...base, log_type: 'time' as const, target_duration_seconds: 5000 }
    const result = applyLogTypeChange(exercise, 'time')
    expect(result.target_duration_seconds).toBe(3600)
  })

  it('nulls the target when switching away from time', () => {
    const exercise = { ...base, log_type: 'time' as const, target_duration_seconds: 45 }
    const result = applyLogTypeChange(exercise, 'weight_reps')
    expect(result.log_type).toBe('weight_reps')
    expect(result.target_duration_seconds).toBeNull()
  })

  it('leaves the target null for bodyweight_reps', () => {
    const exercise = { ...base, log_type: 'weight_reps' as const, target_duration_seconds: null }
    const result = applyLogTypeChange(exercise, 'bodyweight_reps')
    expect(result.log_type).toBe('bodyweight_reps')
    expect(result.target_duration_seconds).toBeNull()
  })

  it('does not mutate the input exercise', () => {
    const exercise = { ...base, log_type: 'weight_reps' as const, target_duration_seconds: null }
    applyLogTypeChange(exercise, 'time')
    expect(exercise.log_type).toBe('weight_reps')
    expect(exercise.target_duration_seconds).toBeNull()
  })
})

describe('inferWorkoutExerciseLogType', () => {
  it('recognizes plural time units so legacy log_type-null rows match the mobile inference', () => {
    expect(inferWorkoutExerciseLogType('Plank', '45 seconds')).toBe('time')
    expect(inferWorkoutExerciseLogType('Plank', '10 minutes')).toBe('time')
    expect(inferWorkoutExerciseLogType('Plank', '45 secs')).toBe('time')
    expect(inferWorkoutExerciseLogType('Plank', '10 mins')).toBe('time')
  })

  it('recognizes erg as a time signal', () => {
    expect(inferWorkoutExerciseLogType('Erg', '500m')).toBe('time')
  })

  it('still infers weight_reps and bodyweight_reps for non-timed exercises', () => {
    expect(inferWorkoutExerciseLogType('Bench Press', '10')).toBe('weight_reps')
    expect(inferWorkoutExerciseLogType('Push Up', '15')).toBe('bodyweight_reps')
  })
})
