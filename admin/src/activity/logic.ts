import type { WorkoutLogRow, WorkoutRow } from './types'

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function mondayIndex(date: Date) {
  return (date.getDay() + 6) % 7
}

export function startOfWeek(date: Date) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - mondayIndex(start))
  return start
}

export function matchesWorkout(log: WorkoutLogRow, workout: WorkoutRow) {
  return log.workout_id === workout.id || (!log.workout_id && log.workout_name === workout.name)
}

export type WeekStatus = 'completed' | 'today' | 'missed' | 'scheduled' | 'rest'

export interface WeekDaySummary {
  date: Date
  workout: WorkoutRow | null
  log: WorkoutLogRow | null
  status: WeekStatus
}

export function buildWeek(workouts: WorkoutRow[], logs: WorkoutLogRow[], now = new Date()): WeekDaySummary[] {
  const weekStart = startOfWeek(now)
  const todayIndex = mondayIndex(now)

  return DAY_NAMES.map((_, dayIndex) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + dayIndex)
    const workout = workouts.find(item => item.day_of_week === dayIndex) ?? null
    const log = logs.find(item => {
      const logged = new Date(item.logged_at)
      return logged >= weekStart && mondayIndex(logged) === dayIndex && (!workout || matchesWorkout(item, workout))
    }) ?? null
    const status: WeekStatus = log
      ? 'completed'
      : dayIndex === todayIndex
        ? 'today'
        : workout && dayIndex < todayIndex
          ? 'missed'
          : workout
            ? 'scheduled'
            : 'rest'
    return { date, workout, log, status }
  })
}

export function parseTargetReps(value: string): number | null {
  const match = value.match(/\d+/)
  return match ? Number(match[0]) : null
}

export function isTimedTarget(value: string) {
  return /(?:sec|second|min|minute|hold|time)/i.test(value)
}

export function completedSets(log: WorkoutLogRow) {
  return log.exercise_logs.reduce((total, exercise) => {
    if (exercise.set_logs.length) return total + exercise.set_logs.filter(set => set.completed).length
    return total + (exercise.sets_completed ?? 0)
  }, 0)
}

export function workoutVolume(log: WorkoutLogRow) {
  return log.exercise_logs.reduce((total, exercise) => total + exercise.set_logs.reduce(
    (exerciseTotal, set) => exerciseTotal + (set.completed ? (set.actual_weight_kg ?? 0) * (set.actual_reps ?? 0) : 0),
    0,
  ), 0)
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`
}

export function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(undefined, options ?? { dateStyle: 'medium' }).format(new Date(value))
}
