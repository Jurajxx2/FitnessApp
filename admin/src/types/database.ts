// admin/src/types/database.ts

export type Goal = 'weight_loss' | 'muscle_gain' | 'mental_strength'
export type RecipeDifficulty = 'easy' | 'medium' | 'hard'
export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'active' | 'very_active'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  age: number | null
  height_cm: number | null
  weight_kg: number | null
  goal: Goal | null
  activity_level: ActivityLevel | null
  onboarding_complete: boolean
  is_admin: boolean
  is_blocked: boolean
  admin_notes: string | null
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
}

export interface WorkoutExercise {
  id: string
  workout_id: string
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
  logged_at: string
  created_at: string
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
  created_at: string
  updated_at: string
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
  video_url: string | null
  difficulty: Difficulty | null
  force: string | null
  mechanic: string | null
  primary_muscles: string[]
  secondary_muscles: string[]
  equipment_names: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}
