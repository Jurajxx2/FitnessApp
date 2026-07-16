import { buildWeek, completedSets, isTimedTarget, matchesWorkout, parseTargetReps, splitAssigned, startOfWeek, weeklyProgress, workoutVolume } from './logic'
import type { WorkoutLogRow, WorkoutRow } from './types'

const workout: WorkoutRow = {
  id: 'workout-1', user_id: null, owner_user_id: null, name: 'Lower body', day_of_week: 0,
  duration_minutes: 45, notes: null, is_active: true, source: 'coach', workout_exercises: [],
}

const log: WorkoutLogRow = {
  id: 'log-1', user_id: 'user-1', workout_id: 'workout-1', workout_name: 'Lower body',
  duration_minutes: 40, notes: null, status: 'completed', logged_at: '2026-07-13T08:00:00.000Z',
  created_at: '2026-07-13T08:00:00.000Z',
  exercise_logs: [{
    id: 'exercise-log-1', workout_log_id: 'log-1', exercise_id: null, exercise_name: 'Squat',
    notes: null, sets_completed: null, reps_completed: null, weight_kg: null,
    set_logs: [
      { id: 'set-1', exercise_log_id: 'exercise-log-1', sort_order: 1, target_reps: 5, actual_reps: 5, target_weight_kg: null, actual_weight_kg: 100, rpe: 8, target_rest_seconds: 120, actual_rest_seconds: null, actual_duration_seconds: null, completed: true },
      { id: 'set-2', exercise_log_id: 'exercise-log-1', sort_order: 2, target_reps: 5, actual_reps: 5, target_weight_kg: null, actual_weight_kg: 100, rpe: 8, target_rest_seconds: 120, actual_rest_seconds: null, actual_duration_seconds: null, completed: false },
    ],
  }],
}

describe('activity logic', () => {
  it('builds a Monday-first week and marks a matching log completed', () => {
    const now = new Date('2026-07-15T12:00:00.000Z')
    const days = buildWeek([workout], [log], now)

    const weekStart = startOfWeek(now)
    expect([weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate(), weekStart.getHours()]).toEqual([2026, 6, 13, 0])
    expect(days).toHaveLength(7)
    expect(days[0].status).toBe('completed')
    expect(days[2].status).toBe('today')
  })

  it('does not count a different workout as assigned-plan compliance', () => {
    const otherLog = { ...log, workout_id: 'workout-2', workout_name: 'Upper body' }
    const days = buildWeek([workout], [otherLog], new Date('2026-07-15T12:00:00.000Z'))
    expect(days[0].status).toBe('missed')
    expect(matchesWorkout(otherLog, workout)).toBe(false)
  })

  it('parses target labels and keeps timed work separate from reps', () => {
    expect(parseTargetReps('8-12')).toBe(8)
    expect(parseTargetReps('Hold')).toBeNull()
    expect(isTimedTarget('45 sec hold')).toBe(true)
    expect(isTimedTarget('8-12')).toBe(false)
  })

  it('derives completed sets and volume only from completed rows', () => {
    expect(completedSets(log)).toBe(1)
    expect(workoutVolume(log)).toBe(500)
  })
})

function assignedWorkout(id: string, dayOfWeek: number | null): WorkoutRow {
  return {
    id, user_id: null, owner_user_id: null, name: `Workout ${id}`, day_of_week: dayOfWeek,
    duration_minutes: 45, notes: null, is_active: true, source: 'coach', workout_exercises: [],
  }
}

function weeklyLog(id: string, workoutId: string | null, loggedAt: string): WorkoutLogRow {
  return {
    id, user_id: 'u1', workout_id: workoutId, workout_name: `Workout ${workoutId}`,
    duration_minutes: 40, notes: null, status: 'completed', logged_at: loggedAt,
    created_at: loggedAt, exercise_logs: [],
  }
}

describe('splitAssigned', () => {
  it('separates pinned from flexible workouts', () => {
    const { pinned, flexible } = splitAssigned([
      assignedWorkout('a', 0), assignedWorkout('b', null), assignedWorkout('c', 4),
    ])

    expect(pinned.map(item => item.id)).toEqual(['a', 'c'])
    expect(flexible.map(item => item.id)).toEqual(['b'])
  })
})

describe('weeklyProgress', () => {
  const now = new Date('2026-07-15T10:00:00')
  const monday = new Date('2026-07-13T09:00:00')
  const lastWeek = new Date('2026-07-05T09:00:00')

  it('counts this-week completions once per workout', () => {
    const workouts = [assignedWorkout('a', null), assignedWorkout('b', null)]
    const logs = [
      weeklyLog('l1', 'a', monday.toISOString()),
      weeklyLog('l2', 'a', now.toISOString()),
      weeklyLog('l3', 'b', lastWeek.toISOString()),
    ]

    const progress = weeklyProgress(workouts, logs, now)

    expect(progress.total).toBe(2)
    expect(progress.completed).toBe(1)
    expect(progress.items.find(item => item.workout.id === 'a')?.log?.id).toBe('l1')
    expect(progress.items.find(item => item.workout.id === 'b')?.log).toBeNull()
  })

  it('excludes future-week logs', () => {
    const progress = weeklyProgress(
      [assignedWorkout('a', null)],
      [weeklyLog('future', 'a', '2026-07-20T09:00:00.000Z')],
      now,
    )

    expect(progress.completed).toBe(0)
    expect(progress.items[0].log).toBeNull()
  })
})

describe('buildWeek with flexible workouts', () => {
  it('does not place flexible workouts on any day', () => {
    const week = buildWeek([assignedWorkout('flex', null)], [], new Date('2026-07-15T10:00:00'))

    expect(week.every(day => day.workout === null)).toBe(true)
  })

  it('does not complete a rest day from an unrelated log', () => {
    const week = buildWeek(
      [assignedWorkout('pinned', 0)],
      [weeklyLog('flex-log', null, '2026-07-15T09:00:00.000Z')],
      new Date('2026-07-15T10:00:00'),
    )

    expect(week[2].workout).toBeNull()
    expect(week[2].log).toBeNull()
    expect(week[2].status).toBe('today')
  })
})
