export type Goal = 'build_muscle' | 'lose_weight' | 'stay_fit' | 'get_stronger'
export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'active' | 'very_active'

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
}

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
