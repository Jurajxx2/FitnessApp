import { supabase } from '../lib/supabase'
import type { MealPlanRow, RecipeRow, MealLogRow, FoodRow } from '../types/database'

export const qk = {
  mealPlan: (userId: string) => ['mealPlan', userId] as const,
  recipes: ['recipes'] as const,
  recipe: (id: string) => ['recipe', id] as const,
  history: (userId: string) => ['mealHistory', userId] as const,
  dailyLogs: (userId: string, date: string) => ['dailyLogs', userId, date] as const,
  foodSearch: (q: string) => ['foodSearch', q] as const,
  favorites: (userId: string) => ['favorites', userId] as const,
  macroTarget: (userId: string) => ['macroTarget', userId] as const,
}

type CurrentMealPlanIdRow = { meal_plan_id: string }
type ActiveNutritionTargetRow = {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export async function fetchActiveNutritionTarget(userId: string): Promise<ActiveNutritionTargetRow | null> {
  const { data, error } = await supabase.rpc('get_active_nutrition_target', { p_user_id: userId })
  if (error) throw error
  return (data as ActiveNutritionTargetRow[] | null)?.[0] ?? null
}

export async function fetchActiveMealPlan(userId: string): Promise<MealPlanRow | null> {
  const { data: resolved, error: resolverError } = await supabase
    .rpc('get_current_meal_plan_id', { p_user_id: userId })
  if (resolverError) throw resolverError

  const mealPlanId = (resolved as CurrentMealPlanIdRow[] | null)?.[0]?.meal_plan_id
  if (!mealPlanId) return null

  const { data, error } = await supabase
    .from('meal_plans')
    .select('*, meals(*, meal_foods(*), meal_plan_recipes(id, recipe_id, snapshot_recipe_name))')
    .eq('id', mealPlanId)
    .maybeSingle()
  if (error) throw error
  return (data as MealPlanRow | null) ?? null
}

export async function fetchRecipes(): Promise<RecipeRow[]> {
  const { data, error } = await supabase.from('recipes').select('*').eq('is_active', true)
  if (error) throw error
  return (data as RecipeRow[]) ?? []
}

export async function fetchRecipe(id: string): Promise<RecipeRow | null> {
  const { data, error } = await supabase
    .from('recipes')
    .select('*, recipe_ingredients(*), recipe_steps(*)')
    .eq('id', id)
    .eq('is_active', true)
    .limit(1)
  if (error) throw error
  return (data?.[0] as RecipeRow) ?? null
}

export async function fetchMealHistory(userId: string): Promise<MealLogRow[]> {
  const { data, error } = await supabase
    .from('meal_logs')
    .select('*, meal_log_foods(*)')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
  if (error) throw error
  return (data as MealLogRow[]) ?? []
}

export async function fetchDailyLogs(userId: string, date: string): Promise<MealLogRow[]> {
  // `date` is a LOCAL calendar day (YYYY-MM-DD). Parse it as local midnight
  // (no `Z` suffix) and take the next local midnight, then convert both to
  // UTC ISO for comparison against the stored UTC `logged_at`. This keeps day
  // bucketing consistent with todayIso()/groupByDay for users off UTC.
  const startLocal = new Date(`${date}T00:00:00`)
  const endLocal = new Date(`${date}T00:00:00`)
  endLocal.setDate(endLocal.getDate() + 1)
  const start = startLocal.toISOString()
  const end = endLocal.toISOString()
  const { data, error } = await supabase
    .from('meal_logs')
    .select('*, meal_log_foods(*)')
    .eq('user_id', userId)
    .gte('logged_at', start)
    .lt('logged_at', end)
  if (error) throw error
  return (data as MealLogRow[]) ?? []
}

export async function searchFoods(query: string): Promise<FoodRow[]> {
  const { data, error } = await supabase
    .from('foods')
    .select('*')
    .ilike('name', `%${query}%`)
    .limit(20)
  if (error) throw error
  return (data as FoodRow[]) ?? []
}

export async function fetchFavoriteIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('recipe_favorites').select('recipe_id').eq('user_id', userId)
  if (error) throw error
  return (data as Array<{ recipe_id: string }>).map(r => r.recipe_id)
}
