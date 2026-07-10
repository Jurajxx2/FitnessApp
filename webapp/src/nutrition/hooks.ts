import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { calcMacroTargets, sumMacros, type Macros } from './calc'
import {
  qk, fetchActiveMealPlan, fetchRecipes, fetchRecipe, fetchMealHistory,
  fetchDailyLogs, searchFoods, fetchFavoriteIds,
} from './queries'

export function useActiveMealPlan() {
  return useQuery({ queryKey: qk.mealPlan, queryFn: fetchActiveMealPlan })
}
export function useRecipes() {
  return useQuery({ queryKey: qk.recipes, queryFn: fetchRecipes })
}
export function useRecipe(id: string) {
  return useQuery({ queryKey: qk.recipe(id), queryFn: () => fetchRecipe(id), enabled: !!id })
}
export function useMealHistory() {
  const { user } = useAuth()
  return useQuery({ queryKey: qk.history, queryFn: () => fetchMealHistory(user!.id), enabled: !!user })
}
export function useDailyLogs(date: string) {
  const { user } = useAuth()
  return useQuery({ queryKey: qk.dailyLogs(date), queryFn: () => fetchDailyLogs(user!.id, date), enabled: !!user })
}
export function useDailySummary(date: string): { data: Macros; isLoading: boolean } {
  const { data, isLoading } = useDailyLogs(date)
  const foods = (data ?? []).flatMap(log => log.meal_log_foods)
  return { data: sumMacros(foods), isLoading }
}
export function useMacroTargets(): Macros | null {
  const { profile } = useAuth()
  if (!profile) return null
  return calcMacroTargets(profile)
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
    queryKey: qk.favorites,
    queryFn: async () => new Set(await fetchFavoriteIds(user!.id)),
    enabled: !!user,
  })
}
