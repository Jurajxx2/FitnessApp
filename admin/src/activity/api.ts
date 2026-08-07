import { supabase } from '../lib/supabase'
import { normalizedTargetDurationSeconds } from '../workouts/builder'
import { parseTargetReps } from './logic'
import type {
  ActivityDraft,
  ExerciseSummary,
  GeneralActivityRow,
  LastExercisePerformance,
  SetLogRow,
  UserWorkoutDraft,
  WorkoutExerciseRow,
  WorkoutLogRow,
  WorkoutRow,
} from './types'
import type { Difficulty, WorkoutFeedback } from '../types/database'

const workoutSelect = `
  *,
  workout_exercises(
    *,
    exercise:exercises!workout_exercises_exercise_id_fkey(
      id, name_en, name_cs, description_en, description_cs,
      image_url, image_url_2, video_url, difficulty,
      primary_muscles, secondary_muscles, equipment_names
    )
  )
`

const logSelect = `
  *,
  exercise_logs(
    *,
    set_logs(*)
  )
`

function sortWorkout(workout: WorkoutRow): WorkoutRow {
  return {
    ...workout,
    workout_exercises: [...(workout.workout_exercises ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }
}

function sortLog(log: WorkoutLogRow): WorkoutLogRow {
  return {
    ...log,
    exercise_logs: (log.exercise_logs ?? []).map(exercise => ({
      ...exercise,
      set_logs: [...(exercise.set_logs ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    })),
  }
}

export async function getAssignedWorkouts(userId: string): Promise<WorkoutRow[]> {
  const [assignments, legacy, own] = await Promise.all([
    supabase.from('user_workouts').select(`workout_id, workouts(${workoutSelect})`).eq('user_id', userId),
    supabase.from('workouts').select(workoutSelect).eq('user_id', userId).eq('is_active', true),
    supabase.from('workouts').select(workoutSelect).eq('owner_user_id', userId).eq('is_active', true),
  ])
  if (assignments.error) throw assignments.error
  if (legacy.error) throw legacy.error
  if (own.error) throw own.error

  const joined = (assignments.data ?? [])
    .map(row => row.workouts as unknown as WorkoutRow | null)
    .filter((row): row is WorkoutRow => Boolean(row?.is_active))
  const unique = new Map<string, WorkoutRow>()
  ;[...joined, ...(legacy.data ?? []) as WorkoutRow[], ...(own.data ?? []) as WorkoutRow[]]
    .map(sortWorkout)
    .forEach(workout => unique.set(workout.id, workout))
  return [...unique.values()].sort((a, b) => (a.day_of_week ?? 7) - (b.day_of_week ?? 7) || a.name.localeCompare(b.name))
}

export async function getWorkoutLibrary(): Promise<WorkoutRow[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select(workoutSelect)
    .is('user_id', null)
    .is('owner_user_id', null)
    .eq('source', 'coach')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return ((data ?? []) as WorkoutRow[]).map(sortWorkout)
}

export async function getWorkout(workoutId: string): Promise<WorkoutRow> {
  const { data, error } = await supabase.from('workouts').select(workoutSelect).eq('id', workoutId).single()
  if (error) throw error
  return sortWorkout(data as WorkoutRow)
}

export async function getWorkoutHistory(userId: string): Promise<WorkoutLogRow[]> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select(logSelect)
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('logged_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as WorkoutLogRow[]).map(sortLog)
}

export async function getWorkoutHistoryPage(userId: string, page: number, pageSize: number): Promise<{ data: WorkoutLogRow[]; count: number }> {
  const { data, count, error } = await supabase
    .from('workout_logs')
    .select(logSelect, { count: 'exact' })
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('logged_at', { ascending: false })
    .order('id')
    .range(page * pageSize, page * pageSize + pageSize - 1)
  if (error) throw error
  return { data: ((data ?? []) as WorkoutLogRow[]).map(sortLog), count: count ?? 0 }
}

export async function getWorkoutLog(userId: string, logId: string): Promise<WorkoutLogRow> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select(logSelect)
    .eq('user_id', userId)
    .eq('id', logId)
    .single()
  if (error) throw error
  return sortLog(data as WorkoutLogRow)
}

// Characters PostgREST's .or() filter syntax treats as structural (comma separates
// conditions, parentheses group/list values). An id containing any of them would
// let a caller break out of the intended filter and inject extra clauses once this
// value is interpolated into the raw filter string below.
const SAFE_FILTER_ID = /^[A-Za-z0-9-]+$/

export async function getWorkoutFeedback(userId: string, workoutLogId: string, exerciseLogIds: string[]): Promise<WorkoutFeedback[]> {
  const base = supabase.from('workout_feedback').select('*').eq('user_id', userId)
  // .or() with an empty in.() list is malformed Postgrest syntax, so fall back to the
  // plain session-level filter when there are no exercise logs to match against.
  // The .eq() path binds workoutLogId as a value (no string interpolation), so it
  // needs no shape check here.
  if (!exerciseLogIds.length) {
    const { data, error } = await base.eq('workout_log_id', workoutLogId).order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as WorkoutFeedback[]
  }
  // The .or() path below builds a raw filter string by interpolating both ids
  // directly. Reject anything that isn't safely id-shaped instead of sending a
  // malformed or maliciously-crafted filter to Postgrest — an empty result is the
  // right call here since this always renders as "no feedback yet", not an error.
  if (!SAFE_FILTER_ID.test(workoutLogId) || !exerciseLogIds.every(id => SAFE_FILTER_ID.test(id))) {
    return []
  }
  const { data, error } = await base
    .or(`workout_log_id.eq.${workoutLogId},exercise_log_id.in.(${exerciseLogIds.join(',')})`)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as WorkoutFeedback[]
}

interface RecentPerformanceWorkout {
  logged_at: string
  exercise_logs: Array<{
    exercise_id: string | null
    set_logs: Array<Pick<SetLogRow, 'actual_reps' | 'actual_weight_kg' | 'actual_duration_seconds' | 'rpe' | 'completed' | 'sort_order'>>
  }>
}

// Picks the performance to surface for one exercise's logs within a single workout:
// the last-attempted completed set (highest sort_order among completed sets).
function lastCompletedSet(
  setLogs: RecentPerformanceWorkout['exercise_logs'][number]['set_logs'],
): RecentPerformanceWorkout['exercise_logs'][number]['set_logs'][number] | undefined {
  return [...(setLogs ?? [])].filter(set => set.completed).sort((a, b) => b.sort_order - a.sort_order)[0]
}

export async function getLastExercisePerformances(userId: string, exerciseIds: string[]): Promise<Record<string, LastExercisePerformance>> {
  const uniqueExerciseIds = [...new Set(exerciseIds.filter(Boolean))]
  if (!uniqueExerciseIds.length) return {}

  // One query per exercise, run concurrently, rather than a single query capped at the
  // most recent 50 completed logs across *all* requested exercises. With a shared cap, an
  // exercise trained every session can fill the whole window and push out an exercise
  // trained less often, even though that exercise has real history further back — the
  // athlete would see no "last time" suggestion despite having logged it before. Per-exercise
  // queries make each exercise's history independent of how often the others are trained.
  // This fans out to at most one query per exercise on the workout screen (bounded by the
  // exercise count in a workout, typically <=12), which is cheap enough to run concurrently.
  //
  // limit(5) rather than limit(1): the single most recent log for an exercise may have no
  // *completed* set at all (the athlete skipped it that session), so we need to look back a
  // few logs to find one with a completed set, same as the previous implementation did
  // within its shared batch. 5 preserves that fallback while keeping each query bounded.
  const perExercise = await Promise.all(
    uniqueExerciseIds.map(async exerciseId => {
      const { data, error } = await supabase
        .from('workout_logs')
        .select(`
          logged_at,
          exercise_logs!inner(
            exercise_id,
            set_logs(actual_reps, actual_weight_kg, actual_duration_seconds, rpe, completed, sort_order)
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'completed')
        .eq('exercise_logs.exercise_id', exerciseId)
        .order('logged_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return [exerciseId, (data ?? []) as unknown as RecentPerformanceWorkout[]] as const
    }),
  )

  const latest: Record<string, LastExercisePerformance> = {}
  for (const [exerciseId, workouts] of perExercise) {
    for (const workout of workouts) {
      const exerciseLog = workout.exercise_logs?.find(exercise => exercise.exercise_id === exerciseId)
      const set = lastCompletedSet(exerciseLog?.set_logs ?? [])
      if (!set) continue
      latest[exerciseId] = {
        logged_at: workout.logged_at,
        actual_reps: set.actual_reps,
        actual_weight_kg: set.actual_weight_kg,
        actual_duration_seconds: set.actual_duration_seconds,
        rpe: set.rpe,
      }
      break
    }
  }
  return latest
}

export async function getActiveWorkout(userId: string): Promise<WorkoutLogRow | null> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select(logSelect)
    .eq('user_id', userId)
    .eq('status', 'in_progress')
    .order('logged_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return data?.[0] ? sortLog(data[0] as WorkoutLogRow) : null
}

async function initialiseWorkoutLog(logId: string, exercises: WorkoutExerciseRow[]) {
  if (!exercises.length) return
  for (const exercise of exercises) {
    // Keep an exact input-to-row mapping. Exercise names are not unique within a
    // workout, so a bulk insert followed by name matching can attach sets to the
    // wrong row when a plan intentionally repeats a movement.
    const { data: exerciseLog, error: exerciseError } = await supabase
      .from('exercise_logs')
      .insert({
      workout_log_id: logId,
      exercise_id: exercise.exercise_id,
      exercise_name: exercise.name,
      notes: null,
      sets_completed: null,
      reps_completed: null,
      weight_kg: null,
      })
      .select('id')
      .single()
    if (exerciseError) throw exerciseError

    const rows = Array.from({ length: Math.max(exercise.sets, 1) }, (_, index) => ({
      exercise_log_id: exerciseLog.id,
      sort_order: index + 1,
      target_reps: exercise.log_type === 'time' ? null : parseTargetReps(exercise.reps),
      actual_reps: null,
      target_weight_kg: null,
      actual_weight_kg: null,
      rpe: null,
      target_rest_seconds: exercise.rest_seconds,
      actual_rest_seconds: null,
      actual_duration_seconds: null,
      completed: false,
    }))
    const { error: setError } = await supabase.from('set_logs').insert(rows)
    if (setError) throw setError
  }
}

export async function startWorkout(userId: string, workout: WorkoutRow): Promise<WorkoutLogRow> {
  const existing = await getActiveWorkout(userId)
  if (existing) return existing

  const { data, error } = await supabase
    .from('workout_logs')
    .insert({
      user_id: userId,
      workout_id: workout.id,
      workout_name: workout.name,
      duration_minutes: 0,
      notes: null,
      status: 'in_progress',
      logged_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      const racedSession = await getActiveWorkout(userId)
      if (racedSession) return racedSession
    }
    throw error
  }

  try {
    await initialiseWorkoutLog(data.id, workout.workout_exercises)
    const created = await getActiveWorkout(userId)
    if (!created) throw new Error('Workout session was created but could not be reopened.')
    return created
  } catch (initialiseError) {
    // This row has never represented a usable session. Delete it so cascading
    // children cannot pollute history; fall back to discarded if cleanup fails.
    const { error: cleanupError } = await supabase.from('workout_logs').delete().eq('id', data.id)
    if (cleanupError) await supabase.from('workout_logs').update({ status: 'discarded' }).eq('id', data.id)
    throw initialiseError
  }
}

export async function createUserWorkout(userId: string, draft: UserWorkoutDraft): Promise<WorkoutRow> {
  const { data: workout, error: workoutError } = await supabase
    .from('workouts')
    .insert({
      owner_user_id: userId,
      source: 'user',
      name: draft.name,
      notes: draft.notes,
      duration_minutes: draft.duration_minutes,
      duration_mode: draft.duration_mode,
      day_of_week: null,
      is_active: true,
    })
    .select('id')
    .single()
  if (workoutError) throw workoutError

  const { error: exercisesError } = await supabase.from('workout_exercises').insert(
    draft.exercises.map((exercise, index) => ({
      workout_id: workout.id,
      exercise_id: exercise.exercise_id,
      name: exercise.name,
      muscle_group: exercise.muscle_group,
      sets: exercise.sets,
      reps: exercise.reps,
      log_type: exercise.log_type,
      // Direct Postgrest insert bypasses the validating RPC, so normalise here (mirrors mobile's
      // WorkoutRepositoryImpl.normalizedTargetDurationSeconds) before the DB CHECK sees it.
      target_duration_seconds: normalizedTargetDurationSeconds(exercise.log_type, exercise.target_duration_seconds),
      rest_seconds: exercise.rest_seconds,
      sort_order: index,
    }))
  )
  if (exercisesError) {
    const { error: cleanupError } = await supabase.from('workouts').delete().eq('id', workout.id)
    if (cleanupError) throw new Error(`Cviky sa nepodarilo uložiť. Vytvorený plán môžeš odstrániť neskôr: ${exercisesError.message}`)
    throw exercisesError
  }

  return getWorkout(workout.id)
}

export async function saveSet(setId: string, values: Partial<Pick<SetLogRow,
  'actual_reps' | 'actual_weight_kg' | 'actual_duration_seconds' | 'rpe' | 'completed'
>>) {
  const { error } = await supabase.from('set_logs').update(values).eq('id', setId)
  if (error) throw error
}

export async function addSet(exerciseLogId: string, sortOrder: number, targetReps: number | null, targetRestSeconds: number | null) {
  const { data, error } = await supabase.from('set_logs').insert({
    exercise_log_id: exerciseLogId,
    sort_order: sortOrder,
    target_reps: targetReps,
    target_rest_seconds: targetRestSeconds,
    completed: false,
  }).select('*').single()
  if (error) throw error
  return data as SetLogRow
}

export async function removeSet(setId: string) {
  const { error } = await supabase.from('set_logs').delete().eq('id', setId)
  if (error) throw error
}

// A session left running (e.g. the athlete forgot to tap "finish" and it stayed open
// overnight) must not record an absurd duration that then feeds Progress totals and
// the coach's compliance dashboard. Clamp is silent — no UI prompt — and floors at 1
// minute so a sub-minute session still counts as completed.
export const MAX_WORKOUT_DURATION_MINUTES = 240

export async function finishWorkout(log: WorkoutLogRow, notes: string | null) {
  const durationMinutes = Math.min(
    MAX_WORKOUT_DURATION_MINUTES,
    Math.max(1, Math.round((Date.now() - new Date(log.logged_at).getTime()) / 60_000))
  )
  const { error } = await supabase
    .from('workout_logs')
    .update({ status: 'completed', duration_minutes: durationMinutes, notes })
    .eq('id', log.id)
    .eq('user_id', log.user_id)
  if (error) throw error
  return durationMinutes
}

export async function discardWorkout(userId: string, logId: string) {
  const { error } = await supabase
    .from('workout_logs')
    .update({ status: 'discarded' })
    .eq('id', logId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function deleteWorkoutLog(userId: string, logId: string): Promise<void> {
  const { error } = await supabase.from('workout_logs').delete().eq('id', logId).eq('user_id', userId)
  if (error) throw error
}

export async function updateWorkoutLog(
  userId: string,
  logId: string,
  values: { logged_at: string; notes: string | null }
): Promise<void> {
  const { error } = await supabase
    .from('workout_logs')
    .update({ logged_at: values.logged_at, notes: values.notes })
    .eq('id', logId)
    .eq('user_id', userId)
  if (error) throw error
}

export const EXERCISE_PAGE_SIZE = 24

export interface ExercisePageFilters {
  search: string
  difficulty: Difficulty | null
  favoriteIds: string[] | null
}

export async function getExercisePage(
  filters: ExercisePageFilters,
  page: number,
  pageSize = EXERCISE_PAGE_SIZE,
): Promise<{ data: ExerciseSummary[]; count: number }> {
  // .in('id', []) is a Postgrest edge case that does not mean "match nothing" reliably;
  // short-circuit instead of hitting the network with an empty favourites filter.
  if (filters.favoriteIds && filters.favoriteIds.length === 0) return { data: [], count: 0 }

  let query = supabase
    .from('exercises')
    .select('id, name_en, name_cs, description_en, description_cs, image_url, image_url_2, video_url, difficulty, primary_muscles, secondary_muscles, equipment_names, exercise_categories(id, name)', { count: 'exact' })
    .eq('is_active', true)
    .order('name_en')
    .order('id')
    .range(page * pageSize, page * pageSize + pageSize - 1)
  if (filters.search) query = query.textSearch('search_vector', filters.search, { type: 'websearch', config: 'simple' })
  if (filters.difficulty) query = query.eq('difficulty', filters.difficulty)
  if (filters.favoriteIds) query = query.in('id', filters.favoriteIds)

  const { data, count, error } = await query
  if (error) throw error
  return { data: (data ?? []) as unknown as ExerciseSummary[], count: count ?? 0 }
}

export async function getExercise(exerciseId: string): Promise<ExerciseSummary> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name_en, name_cs, description_en, description_cs, image_url, image_url_2, video_url, difficulty, primary_muscles, secondary_muscles, equipment_names, exercise_categories(id, name)')
    .eq('id', exerciseId)
    .eq('is_active', true)
    .single()
  if (error) throw error
  return data as unknown as ExerciseSummary
}

export async function getFavoriteExerciseIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('exercise_favorites').select('exercise_id').eq('user_id', userId)
  if (error) throw error
  return (data ?? []).map(row => row.exercise_id)
}

export async function setExerciseFavorite(userId: string, exerciseId: string, favorite: boolean) {
  const query = favorite
    ? supabase.from('exercise_favorites').upsert({ user_id: userId, exercise_id: exerciseId })
    : supabase.from('exercise_favorites').delete().eq('user_id', userId).eq('exercise_id', exerciseId)
  const { error } = await query
  if (error) throw error
}

export async function getGeneralActivities(userId: string): Promise<GeneralActivityRow[]> {
  const { data, error } = await supabase
    .from('general_activity_logs')
    .select('*')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []) as GeneralActivityRow[]
}

// Dedicated single-row fetch for the edit path — the list above is capped at 100 rows,
// so an athlete editing an older activity that fell outside that cap must not be looked
// up by searching it (see LogActivity). .maybeSingle() resolves a genuinely missing row
// to null instead of throwing, so the caller can render a proper not-found state.
export async function getGeneralActivity(userId: string, activityId: string): Promise<GeneralActivityRow | null> {
  const { data, error } = await supabase
    .from('general_activity_logs')
    .select('*')
    .eq('id', activityId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data as GeneralActivityRow | null
}

export async function logGeneralActivity(userId: string, draft: ActivityDraft) {
  const { error } = await supabase.from('general_activity_logs').insert({ user_id: userId, ...draft })
  if (error) throw error
}

export async function updateGeneralActivity(userId: string, activityId: string, draft: ActivityDraft): Promise<void> {
  const { error } = await supabase
    .from('general_activity_logs')
    .update(draft)
    .eq('id', activityId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function deleteGeneralActivity(userId: string, activityId: string): Promise<void> {
  const { error } = await supabase
    .from('general_activity_logs')
    .delete()
    .eq('id', activityId)
    .eq('user_id', userId)
  if (error) throw error
}
