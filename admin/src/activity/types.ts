export interface ExerciseSummary {
  id: string
  name_en: string
  name_cs: string | null
  description_en: string
  description_cs: string | null
  image_url: string | null
  image_url_2: string | null
  video_url: string | null
  difficulty: string | null
  primary_muscles: string[]
  secondary_muscles: string[]
  equipment_names: string[]
  exercise_categories?: { id: number; name: string } | null
}

export interface WorkoutExerciseRow {
  id: string
  workout_id: string
  exercise_id: string | null
  name: string
  muscle_group: string | null
  sets: number
  reps: string
  rest_seconds: number
  tips: string | null
  sort_order: number
  exercise?: ExerciseSummary | null
}

export interface WorkoutRow {
  id: string
  user_id: string | null
  owner_user_id: string | null
  name: string
  day_of_week: number | null
  duration_minutes: number
  notes: string | null
  is_active: boolean
  source: 'coach' | 'user'
  workout_exercises: WorkoutExerciseRow[]
}

export interface UserWorkoutExerciseDraft {
  exercise_id: string
  name: string
  muscle_group: string | null
  sets: number
  reps: string
  rest_seconds: number
}

export interface UserWorkoutDraft {
  name: string
  notes: string | null
  duration_minutes: number
  exercises: UserWorkoutExerciseDraft[]
}

export interface SetLogRow {
  id: string
  exercise_log_id: string
  sort_order: number
  target_reps: number | null
  actual_reps: number | null
  target_weight_kg: number | null
  actual_weight_kg: number | null
  rpe: number | null
  target_rest_seconds: number | null
  actual_rest_seconds: number | null
  actual_duration_seconds: number | null
  completed: boolean
}

export interface ExerciseLogRow {
  id: string
  workout_log_id: string
  exercise_id: string | null
  exercise_name: string
  notes: string | null
  sets_completed: number | null
  reps_completed: string | null
  weight_kg: number | null
  set_logs: SetLogRow[]
}

export interface WorkoutLogRow {
  id: string
  user_id: string
  workout_id: string | null
  workout_name: string
  duration_minutes: number
  notes: string | null
  status: 'in_progress' | 'completed' | 'discarded'
  logged_at: string
  created_at: string
  exercise_logs: ExerciseLogRow[]
}

export type ActivityType = 'WALKING' | 'RUNNING' | 'CYCLING' | 'YOGA' | 'SWIMMING' | 'OTHER'

export interface GeneralActivityRow {
  id: string
  user_id: string
  activity_type: ActivityType
  duration_minutes: number
  distance_km: number | null
  rpe: number | null
  logged_at: string
  notes: string | null
}

export interface ActivityDraft {
  activity_type: ActivityType
  duration_minutes: number
  distance_km: number | null
  rpe: number | null
  logged_at: string
  notes: string | null
}
