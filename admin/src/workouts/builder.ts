export type WorkoutDurationMode = 'auto' | 'manual'

export interface DurationExercise {
  sets: number
  reps: string
  rest_seconds: number
  log_type?: 'weight_reps' | 'bodyweight_reps' | 'time' | null
  target_duration_seconds?: number | null
}

export type WorkoutExerciseLogType = NonNullable<DurationExercise['log_type']>

export const DEFAULT_TIME_TARGET_SECONDS = 30

export const LOG_TYPE_OPTIONS: { value: WorkoutExerciseLogType; label: { en: string; sk: string } }[] = [
  { value: 'weight_reps', label: { en: 'Weight + Reps', sk: 'Váha + opak.' } },
  { value: 'bodyweight_reps', label: { en: 'Bodyweight', sk: 'Vlastná váha' } },
  { value: 'time', label: { en: 'Time', sk: 'Čas' } }
]

export function clampTargetDuration(n: number): number {
  return Math.min(3600, Math.max(1, Math.round(n) || 1))
}

export function applyLogTypeChange<T extends DurationExercise>(exercise: T, next: WorkoutExerciseLogType): T {
  return {
    ...exercise,
    log_type: next,
    target_duration_seconds: next === 'time' ? clampTargetDuration(exercise.target_duration_seconds ?? DEFAULT_TIME_TARGET_SECONDS) : null
  }
}

export function formatSeconds(total: number): string {
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0
  const minutes = Math.floor(safeTotal / 60)
  const seconds = safeTotal % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function inferWorkoutExerciseLogType(name: string, reps = ''): WorkoutExerciseLogType {
  const text = `${name} ${reps}`.toLowerCase()
  if (/\b(run|running|jog|sprint|walk|bike|cycling|rower|rowing|swim|plank|hold|carry|stretch|cardio|time|min|minute|sec|second|beh|běh|ch[uů]ze|kolo|v[yý]drž|protažen[ií])\b/.test(text)) return 'time'
  if (/\b(push ?up|pull ?up|chin ?up|dip|burpee|crunch|sit ?up|bodyweight|calisthenics|no equipment|klik|shyb)\b/.test(text)) return 'bodyweight_reps'
  return 'weight_reps'
}

let draftSequence = 0

export function createExerciseDraftId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  draftSequence += 1
  return `exercise-draft-${draftSequence}`
}

export function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) return items
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

function estimateSetWorkSeconds(reps: string) {
  const normalized = reps.trim().toLowerCase()
  const numbers = normalized.match(/\d+(?:[.,]\d+)?/g)?.map(value => Number(value.replace(',', '.'))) ?? []

  if (/\b(min|mins|minute|minutes|minúta|minúty|minút)\b/.test(normalized) && numbers.length) {
    return Math.min(600, Math.max(20, numbers[0] * 60))
  }
  if (/\b(sec|secs|second|seconds|sek|sekunda|sekundy|sekúnd|s)\b/.test(normalized) && numbers.length) {
    return Math.min(600, Math.max(20, numbers[0]))
  }

  if (!numbers.length) return 40
  const averageReps = numbers.length > 1 ? (numbers[0] + numbers[1]) / 2 : numbers[0]
  return Math.min(90, Math.max(20, averageReps * 4))
}

/**
 * Produces a deliberately conservative pre-workout estimate. Actual duration is
 * still measured from session start to finish and stored on workout_logs.
 */
export function estimateWorkoutDuration(exercises: DurationExercise[]) {
  const active = exercises.filter(exercise => exercise.sets > 0)
  if (!active.length) return 0

  const warmupSeconds = 5 * 60
  const transitionSeconds = Math.max(0, active.length - 1) * 90
  const exerciseSeconds = active.reduce((total, exercise) => {
    const sets = Math.min(20, Math.max(1, Math.round(exercise.sets)))
    const perSetSeconds = exercise.log_type === 'time' && exercise.target_duration_seconds
      ? exercise.target_duration_seconds
      : estimateSetWorkSeconds(exercise.reps)
    const workSeconds = sets * perSetSeconds
    const restSeconds = Math.max(0, sets - 1) * Math.min(900, Math.max(0, exercise.rest_seconds))
    return total + workSeconds + restSeconds
  }, 0)

  return Math.min(360, Math.max(10, Math.ceil((warmupSeconds + transitionSeconds + exerciseSeconds) / 300) * 5))
}
