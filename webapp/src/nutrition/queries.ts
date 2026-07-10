import { supabase } from '../lib/supabase'
import type { MealPlanRow, RecipeRow, MealLogRow, FoodRow } from '../types/database'

export const qk = {
  mealPlan: ['mealPlan'] as const,
  recipes: ['recipes'] as const,
  recipe: (id: string) => ['recipe', id] as const,
  history: ['mealHistory'] as const,
  dailyLogs: (date: string) => ['dailyLogs', date] as const,
  foodSearch: (q: string) => ['foodSearch', q] as const,
  favorites: ['favorites'] as const,
}

export async function fetchActiveMealPlan(): Promise<MealPlanRow | null> {
  const { data, error } = await supabase
    .from('meal_plans')
    .select('*, meals(*, meal_foods(*))')
    .eq('is_active', true)
    .limit(1)
  if (error) throw error
  return (data?.[0] as MealPlanRow) ?? null
}

export async function fetchRecipes(): Promise<RecipeRow[]> {
  const { data, error } = await supabase.from('recipes').select('*')
  if (error) throw error
  return (data as RecipeRow[]) ?? []
}

export async function fetchRecipe(id: string): Promise<RecipeRow | null> {
  const { data, error } = await supabase
    .from('recipes')
    .select('*, recipe_ingredients(*), recipe_steps(*)')
    .eq('id', id)
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
  const start = `${date}T00:00:00Z`
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  const end = `${d.toISOString().slice(0, 10)}T00:00:00Z`
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
