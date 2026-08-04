import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserWorkoutDraft, UserWorkoutExerciseDraft } from './types'

// Captures the rows handed to workout_exercises.insert so we can assert the write-time guard runs
// before the direct Postgrest insert (which bypasses the validating RPC coach plans go through).
let capturedExerciseRows: Array<Record<string, unknown>> | null = null
let recentPerformanceRows: Array<Record<string, unknown>> = []
let capturedHistoryRange: [number, number] | null = null
let capturedExercisePageRange: [number, number] | null = null
let capturedExerciseTextSearch: [string, string, unknown] | null = null
let capturedExerciseEqCalls: Array<[string, unknown]> = []
let capturedExerciseInArgs: [string, string[]] | null = null
let exercisePageQueryCount = 0
let exercisePageMockResult: { data: unknown[]; count: number } = { data: [], count: 0 }

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
      if (table === 'workout_logs') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          in: () => builder,
          order: () => builder,
          limit: () => Promise.resolve({ data: recentPerformanceRows, error: null }),
          range: (from: number, to: number) => {
            capturedHistoryRange = [from, to]
            return Promise.resolve({ data: [], count: 37, error: null })
          },
        }
        return builder
      }
      if (table === 'exercises') {
        const builder: Record<string, unknown> = {
          select: () => builder,
          eq: (column: string, value: unknown) => {
            capturedExerciseEqCalls.push([column, value])
            return builder
          },
          order: () => builder,
          range: (from: number, to: number) => {
            capturedExercisePageRange = [from, to]
            return builder
          },
          textSearch: (column: string, query: string, options: unknown) => {
            capturedExerciseTextSearch = [column, query, options]
            return builder
          },
          in: (column: string, values: string[]) => {
            capturedExerciseInArgs = [column, values]
            return builder
          },
          then: (resolve: (value: { data: unknown[]; count: number; error: null }) => unknown) => {
            exercisePageQueryCount += 1
            return Promise.resolve({ data: exercisePageMockResult.data, count: exercisePageMockResult.count, error: null }).then(resolve)
          },
        }
        return builder
      }
      // 'workouts' must satisfy both the create insert and the getWorkout read-back.
      return {
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'w-new' }, error: null }) }) }),
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 'w-new', name: 'Custom', workout_exercises: [] }, error: null }) }) }),
      }
    },
  },
}))

const { createUserWorkout, getExercisePage, getLastExercisePerformances, getWorkoutHistoryPage } = await import('./api')

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

describe('getLastExercisePerformances', () => {
  it('returns the final completed set from the most recent completed workout for each exercise', async () => {
    recentPerformanceRows = [
      {
        logged_at: '2026-07-25T10:00:00Z',
        exercise_logs: [{
          exercise_id: 'e1',
          set_logs: [
            { actual_reps: 10, actual_weight_kg: 80, actual_duration_seconds: null, rpe: 7, completed: true, sort_order: 1 },
            { actual_reps: 8, actual_weight_kg: 85, actual_duration_seconds: null, rpe: 8, completed: true, sort_order: 2 },
          ],
        }],
      },
      {
        logged_at: '2026-07-20T10:00:00Z',
        exercise_logs: [{
          exercise_id: 'e1',
          set_logs: [{ actual_reps: 12, actual_weight_kg: 70, actual_duration_seconds: null, rpe: 6, completed: true, sort_order: 1 }],
        }],
      },
    ]

    await expect(getLastExercisePerformances('athlete-1', ['e1', 'e1'])).resolves.toEqual({
      e1: {
        logged_at: '2026-07-25T10:00:00Z',
        actual_reps: 8,
        actual_weight_kg: 85,
        actual_duration_seconds: null,
        rpe: 8,
      },
    })
  })
})

describe('getWorkoutHistoryPage', () => {
  it('returns a counted inclusive range for the requested page', async () => {
    capturedHistoryRange = null

    await expect(getWorkoutHistoryPage('athlete-1', 2, 12)).resolves.toEqual({ data: [], count: 37 })
    expect(capturedHistoryRange).toEqual([24, 35])
  })
})

describe('getExercisePage', () => {
  beforeEach(() => {
    capturedExercisePageRange = null
    capturedExerciseTextSearch = null
    capturedExerciseEqCalls = []
    capturedExerciseInArgs = null
    exercisePageQueryCount = 0
    exercisePageMockResult = { data: [{ id: 'ex-1' }], count: 99 }
  })

  it('builds the correct inclusive range for page 2', async () => {
    await getExercisePage({ search: '', difficulty: null, favoriteIds: null }, 2, 24)
    expect(capturedExercisePageRange).toEqual([48, 71])
  })

  it('applies textSearch only when search is non-empty', async () => {
    await getExercisePage({ search: '', difficulty: null, favoriteIds: null }, 0)
    expect(capturedExerciseTextSearch).toBeNull()

    await getExercisePage({ search: 'squat', difficulty: null, favoriteIds: null }, 0)
    expect(capturedExerciseTextSearch).toEqual(['search_vector', 'squat', { type: 'websearch', config: 'simple' }])
  })

  it('applies a difficulty filter only when one is set', async () => {
    await getExercisePage({ search: '', difficulty: null, favoriteIds: null }, 0)
    expect(capturedExerciseEqCalls.some(([column]) => column === 'difficulty')).toBe(false)

    capturedExerciseEqCalls = []
    await getExercisePage({ search: '', difficulty: 'advanced', favoriteIds: null }, 0)
    expect(capturedExerciseEqCalls).toContainEqual(['difficulty', 'advanced'])
  })

  it('filters by favoriteIds when provided', async () => {
    await getExercisePage({ search: '', difficulty: null, favoriteIds: ['ex-1', 'ex-2'] }, 0)
    expect(capturedExerciseInArgs).toEqual(['id', ['ex-1', 'ex-2']])
  })

  it('returns an empty result without querying the network when favoriteIds is an empty array', async () => {
    await expect(getExercisePage({ search: '', difficulty: null, favoriteIds: [] }, 0)).resolves.toEqual({ data: [], count: 0 })
    expect(exercisePageQueryCount).toBe(0)
    expect(capturedExercisePageRange).toBeNull()
  })
})
