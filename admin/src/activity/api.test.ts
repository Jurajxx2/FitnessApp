import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActivityDraft, UserWorkoutDraft, UserWorkoutExerciseDraft, WorkoutLogRow } from './types'

// Captures the rows handed to workout_exercises.insert so we can assert the write-time guard runs
// before the direct Postgrest insert (which bypasses the validating RPC coach plans go through).
let capturedExerciseRows: Array<Record<string, unknown>> | null = null
// Keyed by exercise id: what the per-exercise `.eq('exercise_logs.exercise_id', id)` query
// (the current implementation) returns for that exercise.
let recentPerformanceRowsByExercise: Record<string, Array<Record<string, unknown>>> = {}
// What a single capped `.in('exercise_logs.exercise_id', ids)` query (the old, reverted
// implementation) would return — used only to make the revert-verification failure faithful.
let recentPerformanceCappedRows: Array<Record<string, unknown>> = []
let capturedPerformanceOrderCalls: Array<[string, unknown]> = []
let capturedHistoryRange: [number, number] | null = null
let capturedExercisePageRange: [number, number] | null = null
let capturedExerciseTextSearch: [string, string, unknown] | null = null
let capturedExerciseEqCalls: Array<[string, unknown]> = []
let capturedExerciseOrderCalls: Array<[string, unknown]> = []
let capturedExerciseInArgs: [string, string[]] | null = null
let exercisePageQueryCount = 0
let exercisePageMockResult: { data: unknown[]; count: number } = { data: [], count: 0 }
let capturedFeedbackEqCalls: Array<[string, unknown]> = []
let capturedFeedbackOrArg: string | null = null
let capturedFeedbackOrderArg: [string, unknown] | null = null
let feedbackMockResult: unknown[] = []
let capturedWorkoutLogUpdateValues: Record<string, unknown> | null = null
let capturedWorkoutLogUpdateEqCalls: Array<[string, unknown]> = []
let capturedWorkoutLogDeleteEqCalls: Array<[string, unknown]> = []
let capturedGeneralActivityUpdateValues: Record<string, unknown> | null = null
let capturedGeneralActivityUpdateEqCalls: Array<[string, unknown]> = []
let capturedGeneralActivityDeleteEqCalls: Array<[string, unknown]> = []
let capturedGeneralActivitySelectEqCalls: Array<[string, unknown]> = []
let generalActivityDetailMockResult: unknown = null

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
        // Fresh closure state per `.from('workout_logs')` call, so concurrent per-exercise
        // queries (Promise.all in getLastExercisePerformances) never share filter state.
        let performanceExerciseId: string | null = null
        let performanceIsBulkQuery = false
        const builder = {
          select: () => builder,
          eq: (column: string, value: unknown) => {
            if (column === 'exercise_logs.exercise_id') performanceExerciseId = value as string
            return builder
          },
          in: (column: string) => {
            if (column === 'exercise_logs.exercise_id') performanceIsBulkQuery = true
            return builder
          },
          order: (column: string, options?: unknown) => {
            capturedPerformanceOrderCalls.push([column, options])
            return builder
          },
          limit: () => {
            if (performanceIsBulkQuery) {
              return Promise.resolve({ data: recentPerformanceCappedRows, error: null })
            }
            return Promise.resolve({ data: recentPerformanceRowsByExercise[performanceExerciseId ?? ''] ?? [], error: null })
          },
          range: (from: number, to: number) => {
            capturedHistoryRange = [from, to]
            return Promise.resolve({ data: [], count: 37, error: null })
          },
          update: (values: Record<string, unknown>) => {
            capturedWorkoutLogUpdateValues = values
            capturedWorkoutLogUpdateEqCalls = []
            const updateBuilder = {
              eq: (column: string, value: unknown) => {
                capturedWorkoutLogUpdateEqCalls.push([column, value])
                return updateBuilder
              },
              then: (resolve: (value: { error: null }) => unknown) => Promise.resolve({ error: null }).then(resolve),
            }
            return updateBuilder
          },
          delete: () => {
            capturedWorkoutLogDeleteEqCalls = []
            const deleteBuilder = {
              eq: (column: string, value: unknown) => {
                capturedWorkoutLogDeleteEqCalls.push([column, value])
                return deleteBuilder
              },
              then: (resolve: (value: { error: null }) => unknown) => Promise.resolve({ error: null }).then(resolve),
            }
            return deleteBuilder
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
          order: (column: string, options?: unknown) => {
            capturedExerciseOrderCalls.push([column, options])
            return builder
          },
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
      if (table === 'workout_feedback') {
        const builder: Record<string, unknown> = {
          select: () => builder,
          eq: (column: string, value: unknown) => {
            capturedFeedbackEqCalls.push([column, value])
            return builder
          },
          or: (arg: string) => {
            capturedFeedbackOrArg = arg
            return builder
          },
          order: (column: string, options: unknown) => {
            capturedFeedbackOrderArg = [column, options]
            return Promise.resolve({ data: feedbackMockResult, error: null })
          },
        }
        return builder
      }
      if (table === 'general_activity_logs') {
        return {
          select: () => {
            capturedGeneralActivitySelectEqCalls = []
            const selectBuilder = {
              eq: (column: string, value: unknown) => {
                capturedGeneralActivitySelectEqCalls.push([column, value])
                return selectBuilder
              },
              maybeSingle: () => Promise.resolve({ data: generalActivityDetailMockResult, error: null }),
            }
            return selectBuilder
          },
          update: (values: Record<string, unknown>) => {
            capturedGeneralActivityUpdateValues = values
            capturedGeneralActivityUpdateEqCalls = []
            const updateBuilder = {
              eq: (column: string, value: unknown) => {
                capturedGeneralActivityUpdateEqCalls.push([column, value])
                return updateBuilder
              },
              then: (resolve: (value: { error: null }) => unknown) => Promise.resolve({ error: null }).then(resolve),
            }
            return updateBuilder
          },
          delete: () => {
            capturedGeneralActivityDeleteEqCalls = []
            const deleteBuilder = {
              eq: (column: string, value: unknown) => {
                capturedGeneralActivityDeleteEqCalls.push([column, value])
                return deleteBuilder
              },
              then: (resolve: (value: { error: null }) => unknown) => Promise.resolve({ error: null }).then(resolve),
            }
            return deleteBuilder
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

const {
  createUserWorkout,
  deleteGeneralActivity,
  deleteWorkoutLog,
  discardWorkout,
  finishWorkout,
  getExercisePage,
  getGeneralActivity,
  getLastExercisePerformances,
  getWorkoutFeedback,
  getWorkoutHistoryPage,
  updateGeneralActivity,
  updateWorkoutLog,
} = await import('./api')

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
  beforeEach(() => {
    recentPerformanceRowsByExercise = {}
    recentPerformanceCappedRows = []
    capturedPerformanceOrderCalls = []
  })

  it('orders by logged_at descending with a secondary id tie-break, matching its three neighbours', async () => {
    recentPerformanceRowsByExercise = { e1: [] }

    await getLastExercisePerformances('athlete-1', ['e1'])

    expect(capturedPerformanceOrderCalls).toEqual([
      ['logged_at', { ascending: false }],
      ['id', undefined],
    ])
  })

  it('returns the final completed set from the most recent completed workout for each exercise', async () => {
    recentPerformanceRowsByExercise = {
      e1: [
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
      ],
    }

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

  // Regression test for the defect fixed in this task: a single shared query capped at the
  // 50 most recent completed logs (across ALL requested exercises) let a frequently-trained
  // exercise crowd a rarely-trained one out of the window entirely, even though the
  // rarely-trained exercise has real completed history further back. Resolving each exercise
  // with its own query removes that cross-exercise interference.
  it('surfaces both exercises when one saturates recent logs and the other only has an older completed set', async () => {
    // Exercise A: trained in every one of the 50 most recent completed workouts.
    recentPerformanceCappedRows = Array.from({ length: 50 }, (_, index) => ({
      logged_at: `2026-06-${String(30 - (index % 28)).padStart(2, '0')}T10:00:00Z`,
      exercise_logs: [{
        exercise_id: 'exercise-a',
        set_logs: [{ actual_reps: 5, actual_weight_kg: 100, actual_duration_seconds: null, rpe: 8, completed: true, sort_order: 1 }],
      }],
    }))
    recentPerformanceRowsByExercise = {
      'exercise-a': [
        {
          logged_at: '2026-07-25T10:00:00Z',
          exercise_logs: [{
            exercise_id: 'exercise-a',
            set_logs: [{ actual_reps: 5, actual_weight_kg: 100, actual_duration_seconds: null, rpe: 8, completed: true, sort_order: 1 }],
          }],
        },
      ],
      // Exercise B's only completed set is far older than any of A's 50 recent logs.
      'exercise-b': [
        {
          logged_at: '2024-01-10T10:00:00Z',
          exercise_logs: [{
            exercise_id: 'exercise-b',
            set_logs: [{ actual_reps: 12, actual_weight_kg: 20, actual_duration_seconds: null, rpe: 5, completed: true, sort_order: 1 }],
          }],
        },
      ],
    }

    const result = await getLastExercisePerformances('athlete-1', ['exercise-a', 'exercise-b'])

    expect(result['exercise-a']).toBeDefined()
    expect(result['exercise-b']).toBeDefined()
    expect(result['exercise-b']).toEqual({
      logged_at: '2024-01-10T10:00:00Z',
      actual_reps: 12,
      actual_weight_kg: 20,
      actual_duration_seconds: null,
      rpe: 5,
    })
  })

  // Regression test for the defect fixed in this task: initialiseWorkoutLog's own comment
  // notes exercise names (and, by extension, exercise_logs.exercise_id) are not unique
  // within a workout — a plan can intentionally repeat a movement (e.g. as both a warm-up
  // and a working-set block). Taking only the *first* matching exercise_log per workout
  // abandoned the whole workout's suggestion whenever that particular log had no completed
  // set, even though a later log for the same exercise in the same workout did.
  it('resolves from a later exercise_log in the same workout when an earlier one for the same exercise has no completed set', async () => {
    recentPerformanceRowsByExercise = {
      e1: [
        {
          logged_at: '2026-07-25T10:00:00Z',
          exercise_logs: [
            // Warm-up block: logged first, but the athlete skipped it — no completed set.
            { exercise_id: 'e1', set_logs: [{ actual_reps: null, actual_weight_kg: null, actual_duration_seconds: null, rpe: null, completed: false, sort_order: 1 }] },
            // Working block: same exercise, repeated later in the same workout, completed.
            { exercise_id: 'e1', set_logs: [{ actual_reps: 6, actual_weight_kg: 90, actual_duration_seconds: null, rpe: 8, completed: true, sort_order: 1 }] },
          ],
        },
      ],
    }

    await expect(getLastExercisePerformances('athlete-1', ['e1'])).resolves.toEqual({
      e1: {
        logged_at: '2026-07-25T10:00:00Z',
        actual_reps: 6,
        actual_weight_kg: 90,
        actual_duration_seconds: null,
        rpe: 8,
      },
    })
  })

  // Second half of the same regression: when the *newest* workout has no completed set for
  // the exercise anywhere in it (not even in a repeated log), the search must fall through
  // to an older workout still inside the 5-row window — the reason limit(5) exists at all.
  it('falls through to an older workout inside the 5-row window when the newest workout has no completed set for the exercise at all', async () => {
    recentPerformanceRowsByExercise = {
      e1: [
        {
          logged_at: '2026-07-25T10:00:00Z',
          exercise_logs: [
            { exercise_id: 'e1', set_logs: [{ actual_reps: null, actual_weight_kg: null, actual_duration_seconds: null, rpe: null, completed: false, sort_order: 1 }] },
          ],
        },
        {
          logged_at: '2026-07-18T10:00:00Z',
          exercise_logs: [
            { exercise_id: 'e1', set_logs: [{ actual_reps: 10, actual_weight_kg: 60, actual_duration_seconds: null, rpe: 7, completed: true, sort_order: 1 }] },
          ],
        },
      ],
    }

    await expect(getLastExercisePerformances('athlete-1', ['e1'])).resolves.toEqual({
      e1: {
        logged_at: '2026-07-18T10:00:00Z',
        actual_reps: 10,
        actual_weight_kg: 60,
        actual_duration_seconds: null,
        rpe: 7,
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
    capturedExerciseOrderCalls = []
    capturedExerciseInArgs = null
    exercisePageQueryCount = 0
    exercisePageMockResult = { data: [{ id: 'ex-1' }], count: 99 }
  })

  it('builds the correct inclusive range for page 2', async () => {
    await getExercisePage({ search: '', difficulty: null, favoriteIds: null }, 2, 24)
    expect(capturedExercisePageRange).toEqual([48, 71])
  })

  it('orders by name_en with a secondary id tie-break, so offset pagination over the non-unique name cannot skip or duplicate rows', async () => {
    await getExercisePage({ search: '', difficulty: null, favoriteIds: null }, 0)
    expect(capturedExerciseOrderCalls).toEqual([['name_en', undefined], ['id', undefined]])
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

describe('getWorkoutFeedback', () => {
  beforeEach(() => {
    capturedFeedbackEqCalls = []
    capturedFeedbackOrArg = null
    capturedFeedbackOrderArg = null
    feedbackMockResult = []
  })

  it('uses the .eq(workout_log_id) path — not .or() — when exerciseLogIds is empty', async () => {
    feedbackMockResult = [{ id: 'f1', workout_log_id: 'log-1', exercise_log_id: null }]

    await expect(getWorkoutFeedback('athlete-1', 'log-1', [])).resolves.toEqual(feedbackMockResult)

    expect(capturedFeedbackEqCalls).toContainEqual(['user_id', 'athlete-1'])
    expect(capturedFeedbackEqCalls).toContainEqual(['workout_log_id', 'log-1'])
    expect(capturedFeedbackOrArg).toBeNull()
    expect(capturedFeedbackOrderArg).toEqual(['created_at', { ascending: true }])
  })

  it('uses the .or() path with an in.() list when exerciseLogIds is non-empty', async () => {
    await getWorkoutFeedback('athlete-1', 'log-1', ['ex-1', 'ex-2'])

    expect(capturedFeedbackEqCalls).toEqual([['user_id', 'athlete-1']])
    expect(capturedFeedbackEqCalls.some(([column]) => column === 'workout_log_id')).toBe(false)
    expect(capturedFeedbackOrArg).toBe('workout_log_id.eq.log-1,exercise_log_id.in.(ex-1,ex-2)')
  })

  it('returns an empty array without querying the network when workoutLogId could break out of the .or() filter', async () => {
    await expect(getWorkoutFeedback('athlete-1', 'log-1),exercise_log_id.in.(evil', ['ex-1'])).resolves.toEqual([])

    expect(capturedFeedbackOrArg).toBeNull()
  })

  it('returns an empty array without querying the network when an exerciseLogId could break out of the .or() filter', async () => {
    await expect(getWorkoutFeedback('athlete-1', 'log-1', ['ex-1', 'ex-2),workout_log_id.eq.evil'])).resolves.toEqual([])

    expect(capturedFeedbackOrArg).toBeNull()
  })
})

describe('finishWorkout duration clamp', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('clamps a 12-hour elapsed session to the 240-minute cap, not 720', async () => {
    const startedAt = new Date('2026-08-04T00:00:00.000Z')
    vi.spyOn(Date, 'now').mockReturnValue(startedAt.getTime() + 12 * 60 * 60_000)
    const log = { id: 'log-1', user_id: 'athlete-1', logged_at: startedAt.toISOString() } as WorkoutLogRow

    await expect(finishWorkout(log, null)).resolves.toBe(240)
  })

  it('still floors at 1 minute for a sub-minute session', async () => {
    const startedAt = new Date('2026-08-04T00:00:00.000Z')
    vi.spyOn(Date, 'now').mockReturnValue(startedAt.getTime() + 10_000)
    const log = { id: 'log-1', user_id: 'athlete-1', logged_at: startedAt.toISOString() } as WorkoutLogRow

    await expect(finishWorkout(log, null)).resolves.toBe(1)
  })
})

describe('finishWorkout user_id predicate', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('filters the update by both id and the row\'s own user_id, matching deleteWorkoutLog/updateWorkoutLog\'s defence in depth', async () => {
    capturedWorkoutLogUpdateEqCalls = []
    const startedAt = new Date('2026-08-04T00:00:00.000Z')
    vi.spyOn(Date, 'now').mockReturnValue(startedAt.getTime() + 30 * 60_000)
    const log = { id: 'log-1', user_id: 'athlete-1', logged_at: startedAt.toISOString() } as WorkoutLogRow

    await finishWorkout(log, null)

    expect(capturedWorkoutLogUpdateEqCalls).toEqual([
      ['id', 'log-1'],
      ['user_id', 'athlete-1'],
    ])
  })
})

describe('discardWorkout', () => {
  it('filters the update by both id and user_id, matching deleteWorkoutLog/updateWorkoutLog\'s defence in depth', async () => {
    capturedWorkoutLogUpdateEqCalls = []

    await discardWorkout('athlete-1', 'log-1')

    expect(capturedWorkoutLogUpdateEqCalls).toEqual([
      ['id', 'log-1'],
      ['user_id', 'athlete-1'],
    ])
  })
})

describe('deleteWorkoutLog', () => {
  it('filters the delete on both id and user_id, matching useDeleteMealLog\'s defence in depth', async () => {
    capturedWorkoutLogDeleteEqCalls = []

    await deleteWorkoutLog('athlete-1', 'log-1')

    expect(capturedWorkoutLogDeleteEqCalls).toEqual([
      ['id', 'log-1'],
      ['user_id', 'athlete-1'],
    ])
  })
})

describe('updateWorkoutLog', () => {
  it('sends only logged_at and notes, filtered by id and user_id', async () => {
    capturedWorkoutLogUpdateValues = null
    capturedWorkoutLogUpdateEqCalls = []

    await updateWorkoutLog('athlete-1', 'log-1', { logged_at: '2026-08-01T10:00:00.000Z', notes: 'Felt strong' })

    expect(capturedWorkoutLogUpdateValues).toEqual({ logged_at: '2026-08-01T10:00:00.000Z', notes: 'Felt strong' })
    expect(Object.keys(capturedWorkoutLogUpdateValues!)).toEqual(['logged_at', 'notes'])
    expect(capturedWorkoutLogUpdateEqCalls).toEqual([
      ['id', 'log-1'],
      ['user_id', 'athlete-1'],
    ])
  })
})

describe('deleteGeneralActivity', () => {
  it('filters the delete on both id and user_id', async () => {
    capturedGeneralActivityDeleteEqCalls = []

    await deleteGeneralActivity('athlete-1', 'activity-1')

    expect(capturedGeneralActivityDeleteEqCalls).toEqual([
      ['id', 'activity-1'],
      ['user_id', 'athlete-1'],
    ])
  })
})

describe('getGeneralActivity', () => {
  beforeEach(() => {
    capturedGeneralActivitySelectEqCalls = []
    generalActivityDetailMockResult = null
  })

  it('filters by both id and user_id and returns the row via maybeSingle', async () => {
    generalActivityDetailMockResult = { id: 'activity-1', user_id: 'athlete-1', activity_type: 'RUNNING' }

    await expect(getGeneralActivity('athlete-1', 'activity-1')).resolves.toEqual(generalActivityDetailMockResult)

    expect(capturedGeneralActivitySelectEqCalls).toEqual([
      ['id', 'activity-1'],
      ['user_id', 'athlete-1'],
    ])
  })

  it('resolves null instead of throwing when the row does not exist', async () => {
    generalActivityDetailMockResult = null

    await expect(getGeneralActivity('athlete-1', 'missing-activity')).resolves.toBeNull()
  })
})

describe('updateGeneralActivity', () => {
  it('sends the full draft, filtered by id and user_id', async () => {
    capturedGeneralActivityUpdateValues = null
    capturedGeneralActivityUpdateEqCalls = []
    const draft: ActivityDraft = {
      activity_type: 'RUNNING',
      duration_minutes: 40,
      distance_km: 5,
      rpe: 6,
      logged_at: '2026-08-01T09:00:00.000Z',
      notes: null,
    }

    await updateGeneralActivity('athlete-1', 'activity-1', draft)

    expect(capturedGeneralActivityUpdateValues).toEqual(draft)
    expect(capturedGeneralActivityUpdateEqCalls).toEqual([
      ['id', 'activity-1'],
      ['user_id', 'athlete-1'],
    ])
  })
})
