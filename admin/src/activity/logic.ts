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
  const nextWeekStart = new Date(weekStart)
  nextWeekStart.setDate(weekStart.getDate() + 7)
  const todayIndex = mondayIndex(now)

  return DAY_NAMES.map((_, dayIndex) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + dayIndex)
    const workout = workouts.find(item => item.day_of_week === dayIndex) ?? null
    const log = logs.find(item => {
      const logged = new Date(item.logged_at)
      return logged >= weekStart && logged < nextWeekStart && mondayIndex(logged) === dayIndex && workout != null && matchesWorkout(item, workout)
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

// Renders a Date as the local wall-clock value a <input type="datetime-local"> expects
// (YYYY-MM-DDTHH:mm), by shifting off the timezone offset before formatting as ISO.
export function toLocalDateTimeInputValue(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function splitAssigned(workouts: WorkoutRow[]): { pinned: WorkoutRow[]; flexible: WorkoutRow[] } {
  return {
    pinned: workouts.filter(item => item.day_of_week != null),
    flexible: workouts.filter(item => item.day_of_week == null),
  }
}

export interface WeeklyItem {
  workout: WorkoutRow
  log: WorkoutLogRow | null
}

export interface WeeklyProgress {
  items: WeeklyItem[]
  completed: number
  total: number
}

export function weeklyProgress(workouts: WorkoutRow[], logs: WorkoutLogRow[], now = new Date()): WeeklyProgress {
  const weekStart = startOfWeek(now)
  const nextWeekStart = new Date(weekStart)
  nextWeekStart.setDate(weekStart.getDate() + 7)
  const thisWeek = logs.filter(item => {
    const loggedAt = new Date(item.logged_at)
    return loggedAt >= weekStart && loggedAt < nextWeekStart
  })
  const claimed = new Set<string>()
  const items: WeeklyItem[] = workouts.map(workout => {
    const match = thisWeek.find(item => !claimed.has(item.id) && matchesWorkout(item, workout)) ?? null
    if (match) claimed.add(match.id)
    return { workout, log: match }
  })

  return { items, completed: items.filter(item => item.log).length, total: items.length }
}
