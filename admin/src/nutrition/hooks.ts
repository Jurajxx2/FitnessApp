import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { calcMacroTargets, sumMacros, type Macros } from './calc'
import {
  qk, fetchActiveMealPlan, fetchRecipes, fetchRecipe, fetchMealHistory,
  fetchDailyLogs, searchFoods, fetchFavoriteIds, fetchActiveNutritionTarget,
} from './queries'

export function useActiveMealPlan() {
  const { user } = useAuth()
  return useQuery({
    queryKey: qk.mealPlan(user?.id ?? ''),
    queryFn: () => fetchActiveMealPlan(user!.id),
    enabled: !!user,
  })
}
export function useRecipes() {
  return useQuery({ queryKey: qk.recipes, queryFn: fetchRecipes })
}
export function useRecipe(id: string) {
  return useQuery({ queryKey: qk.recipe(id), queryFn: () => fetchRecipe(id), enabled: !!id })
}
export function useMealHistory() {
  const { user } = useAuth()
  return useQuery({ queryKey: qk.history(user?.id ?? ''), queryFn: () => fetchMealHistory(user!.id), enabled: !!user })
}
export function useDailyLogs(date: string) {
  const { user } = useAuth()
  return useQuery({ queryKey: qk.dailyLogs(user?.id ?? '', date), queryFn: () => fetchDailyLogs(user!.id, date), enabled: !!user })
}
export function useDailySummary(date: string): { data: Macros; isLoading: boolean } {
  const { data, isLoading } = useDailyLogs(date)
  const foods = (data ?? []).flatMap(log => log.meal_log_foods)
  return { data: sumMacros(foods), isLoading }
}
export function useMacroTargets(): Macros | null {
  const { user, profile } = useAuth()
  const { data } = useQuery({
    queryKey: qk.macroTarget(user?.id ?? ''),
    queryFn: () => fetchActiveNutritionTarget(user!.id),
    enabled: !!user,
  })
  if (data) return data
  return profile ? calcMacroTargets(profile) : null
}
export function useFoodSearch(query: string) {
  return useQuery({
    queryKey: qk.foodSearch(query),
    queryFn: () => searchFoods(query),
    enabled: query.trim().length >= 2,
  })
}
export function useFavorites() {
  const { user } = useAuth()
  return useQuery({
    queryKey: qk.favorites(user?.id ?? ''),
    queryFn: async () => new Set(await fetchFavoriteIds(user!.id)),
    enabled: !!user,
  })
}
