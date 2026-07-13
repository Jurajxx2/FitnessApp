import { buildWeek, completedSets, isTimedTarget, matchesWorkout, parseTargetReps, startOfWeek, workoutVolume } from './logic'
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
