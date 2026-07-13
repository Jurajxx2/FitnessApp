// admin/src/types/database.ts

export type Goal = 'build_muscle' | 'lose_weight' | 'stay_fit' | 'get_stronger'
export type RecipeDifficulty = 'easy' | 'medium' | 'hard'
export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'active' | 'very_active'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type AccessMode = 'nutrition' | 'activity' | 'both'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  age: number | null
  height_cm: number | null
  weight_kg: number | null
  gender?: 'male' | 'female' | null
  goal: Goal | null
  activity_level: ActivityLevel | null
  onboarding_complete: boolean
  is_admin: boolean
  is_blocked: boolean
  access_mode: AccessMode
  admin_notes: string | null
  created_at: string
  updated_at: string
}

export interface OnboardingResponse {
  user_id: string
  gender: 'male' | 'female' | null
  goal: Goal | null
  experience_level: 'beginner' | 'intermediate' | 'advanced' | 'expert' | null
  focus_areas: string[]
  frequency_per_week: number | null
  equipment: 'no_equipment' | 'dumbbells' | 'home_gym' | 'full_gym' | null
  age: number | null
  height_cm: number | null
  weight_kg: number | null
  use_metric: boolean
  training_preference: 'with_coach' | 'self_guided' | 'both' | null
  name: string | null
  bmi: number | null
  completed_at: string
  created_at: string
  updated_at: string
}

export interface Workout {
  id: string
  coach_id: string | null
  user_id: string | null
  name: string
  day_of_week: number | null
  duration_minutes: number
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  source?: 'coach' | 'user'
  owner_user_id?: string | null
  forked_from_workout_id?: string | null
}

export interface WorkoutExercise {
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
  created_at: string
}

export interface WorkoutLog {
  id: string
  user_id: string
  workout_id: string | null
  workout_name: string
  duration_minutes: number
  notes: string | null
  status?: 'in_progress' | 'completed' | 'discarded'
  logged_at: string
  created_at: string
}

export interface ExerciseLog {
  id: string
  workout_log_id: string
  exercise_name: string
  sets_completed: number | null
  reps_completed: string | null
  weight_kg: number | null
  notes: string | null
  created_at?: string
}

export interface SetLog {
  id: string
  exercise_log_id: string
  sort_order: number
  target_reps: number | null
  actual_reps: number | null
  target_weight_kg: number | null
  actual_weight_kg: number | null
  rpe: number | null
  completed: boolean
  created_at?: string
}

export interface WorkoutFeedback {
  id: string
  user_id: string
  coach_id: string
  workout_log_id: string | null
  exercise_log_id: string | null
  body: string
  created_at: string
  updated_at: string
}

export interface MealPlan {
  id: string
  coach_id: string | null
  user_id: string | null
  name: string
  description: string | null
  valid_from: string | null
  valid_to: string | null
  is_active: boolean
  origin?: 'manual' | 'generated'
  created_at: string
  updated_at: string
}

export interface NutritionTarget {
  id: string
  user_id: string
  source: 'calculated' | 'user' | 'admin'
  created_by: string | null
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g_min: number | null
  version: number
  is_locked: boolean
  effective_from: string
  effective_to: string | null
  created_at: string
}

export interface Meal {
  id: string
  meal_plan_id: string
  name: string
  time_of_day: string | null
  sort_order: number
}

export interface MealFood {
  id: string
  meal_id: string
  name: string
  amount_grams: number
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface MealLog {
  id: string
  user_id: string
  meal_name: string
  notes: string | null
  image_url: string | null
  logged_at: string
  created_at?: string
}

export interface MealLogFood {
  id: string
  meal_log_id: string
  name: string
  amount: number | null
  unit: string | null
  amount_grams: number | null
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface Recipe {
  id: string
  external_id: string | null
  photo_file_name: string | null
  photo_url: string | null
  name: string
  description: string | null
  prep_time_min: number | null
  cook_time_min: number | null
  servings: number
  difficulty: RecipeDifficulty | null
  tags: string[]
  steps: string[]
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  featured: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RecipeIngredient {
  id: string
  recipe_id: string
  name: string
  quantity: number | null
  unit: string | null
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  sort_order: number
}

export interface Food {
  id: string
  name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  serving_size: number
  serving_unit: string
  brand: string | null
  is_verified: boolean
  created_at: string
  updated_at: string
}

export interface MealPlanRecipe {
  id: string
  meal_plan_id: string
  recipe_id: string
  meal_id: string | null
  meal_type: MealType | null
  day_of_week: number | null
  created_at: string
}

export interface DailyQuote {
  id: string
  text: string
  author: string | null
  is_active: boolean
  scheduled_date: string | null
  created_at: string
  updated_at: string
}

export interface WeightEntry {
  id: string
  user_id: string
  weight_kg: number
  recorded_at: string
  notes: string | null
  created_at: string
}

export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

export interface ExerciseCategory {
  id: number
  name: string
}

export interface Exercise {
  id: string
  name_en: string
  description_en: string
  name_cs: string | null
  description_cs: string | null
  category_id: number | null
  image_url: string | null
  image_url_2: string | null
  video_url: string | null
  difficulty: Difficulty | null
  force: string | null
  mechanic: string | null
  primary_muscles: string[]
  secondary_muscles: string[]
  equipment_names: string[]
  is_active: boolean
  external_id: string | null
  source_provider: string
  created_at: string
  updated_at: string
}

export type ChatType = 'human' | 'ai'
export type SenderType = 'user' | 'coach' | 'ai'
export type ContentType = 'text' | 'image'

export interface ChatMessage {
  id: string
  user_id: string
  chat_type: ChatType
  sender_type: SenderType
  content_type: ContentType
  text_content: string | null
  image_url: string | null
  created_at: string
  read_at: string | null
}

export interface CheckIn {
  id: string
  user_id: string
  week_of: string
  weight_kg: number | null
  energy_level: number | null
  sleep_quality: number | null
  stress_level: number | null
  training_adherence: number | null
  nutrition_adherence: number | null
  notes: string | null
  photo_front_path: string | null
  photo_side_path: string | null
  coach_id: string | null
  coach_response: string | null
  coach_response_at: string | null
  created_at: string
  updated_at: string
}

// Athlete portal query shapes. These include nested relations returned by
// PostgREST and intentionally remain separate from the admin editor models.
export interface MealFoodRow {
  id: string
  meal_id: string
  name: string
  amount_grams: number
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface MealRow {
  id: string
  meal_plan_id: string
  name: string
  time_of_day: string | null
  sort_order: number
  day_of_week: number | null
  meal_foods: MealFoodRow[]
}

export interface MealPlanRow {
  id: string
  name: string
  description: string | null
  valid_from: string | null
  valid_to: string | null
  meals: MealRow[]
}

export interface RecipeIngredientRow {
  id: string
  recipe_id: string
  name: string
  quantity: number | null
  unit: string | null
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  sort_order: number
}

export interface RecipeStepRow {
  id: string
  recipe_id: string
  step_number: number
  instruction: string
}

export interface RecipeRow {
  id: string
  name: string
  description: string | null
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  photo_url: string | null
  prep_time_min: number | null
  cook_time_min: number | null
  servings: number
  difficulty: string | null
  tags: string[]
  featured: boolean
  is_active: boolean
  recipe_ingredients?: RecipeIngredientRow[]
  recipe_steps?: RecipeStepRow[]
}

export interface MealLogFoodRow {
  id: string
  meal_log_id: string
  name: string
  amount: number
  unit: string
  amount_grams: number | null
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface MealLogRow {
  id: string
  user_id: string
  meal_name: string
  notes: string | null
  image_url: string | null
  logged_at: string
  meal_log_foods: MealLogFoodRow[]
}

export interface FoodRow {
  id: string
  name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  serving_size: number
  serving_unit: string
  brand: string | null
  is_verified: boolean
}

export type CheckInRow = CheckIn
