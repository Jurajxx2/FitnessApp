import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserWorkoutDraft, UserWorkoutExerciseDraft } from './types'

// Captures the rows handed to workout_exercises.insert so we can assert the write-time guard runs
// before the direct Postgrest insert (which bypasses the validating RPC coach plans go through).
let capturedExerciseRows: Array<Record<string, unknown>> | null = null

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'workout_exercises') {
        return {
          insert: (rows: Array<Record<string, unknown>>) => {
            capturedExerciseRows = rows
            return Promise.resolve({ error: null })
          },
        }
      }
      // 'workouts' must satisfy both the create insert and the getWorkout read-back.
      return {
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'w-new' }, error: null }) }) }),
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 'w-new', name: 'Custom', workout_exercises: [] }, error: null }) }) }),
      }
    },
  },
}))

const { createUserWorkout } = await import('./api')

function exercise(overrides: Partial<UserWorkoutExerciseDraft>): UserWorkoutExerciseDraft {
  return {
    client_id: 'c1',
    exercise_id: 'e1',
    name: 'Exercise',
    muscle_group: null,
    sets: 3,
    reps: '10',
    log_type: 'weight_reps',
    target_duration_seconds: null,
    rest_seconds: 60,
    image_url: null,
    image_url_2: null,
    ...overrides,
  }
}

describe('createUserWorkout write-time normalisation', () => {
  beforeEach(() => {
    capturedExerciseRows = null
  })

  it('nulls a stray duration on a non-time exercise and defaults/clamps time durations before insert', async () => {
    const draft: UserWorkoutDraft = {
      name: 'My plan',
      notes: null,
      duration_minutes: 30,
      duration_mode: 'manual',
      exercises: [
        exercise({ log_type: 'weight_reps', target_duration_seconds: 999 }),
        exercise({ log_type: 'time', target_duration_seconds: null }),
        exercise({ log_type: 'time', target_duration_seconds: 5000 }),
      ],
    }

    await createUserWorkout('athlete-1', draft)

    expect(capturedExerciseRows).not.toBeNull()
    const rows = capturedExerciseRows!
    expect(rows[0].log_type).toBe('weight_reps')
    expect(rows[0].target_duration_seconds).toBeNull()
    expect(rows[1].log_type).toBe('time')
    expect(rows[1].target_duration_seconds).toBe(30)
    expect(rows[2].log_type).toBe('time')
    expect(rows[2].target_duration_seconds).toBe(3600)
  })
})
