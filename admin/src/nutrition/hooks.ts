import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { calcMacroTargets, sumMacros, type Macros } from './calc'
import { mealsForDay, todayDowMon0 } from './mealPlan'
import {
  qk, fetchActiveMealPlan, fetchRecipes, fetchFeaturedRecipes, fetchRecipe, fetchMealHistory, fetchMealLog,
  fetchDailyLogs, searchFoods, fetchFavoriteIds, fetchActiveNutritionTarget,
  fetchFoodFavorites, fetchRecentFoods, fetchSavedMeals,
  fetchSeedFoods,
} from './queries'

export function useActiveMealPlan(enabled = true) {
  const { user } = useAuth()
  return useQuery({
    queryKey: qk.mealPlan(user?.id ?? ''),
    queryFn: () => fetchActiveMealPlan(user!.id),
    enabled: !!user && enabled,
  })
}
export function useTodayPlannedMeals() {
  const { data: plan, isLoading } = useActiveMealPlan()
  const data = plan ? mealsForDay(plan.meals ?? [], todayDowMon0()) : []
  return { data, isLoading }
}
export function useRecipes(page = 0, pageSize = 24, search = '', favoriteIds: string[] | null = null) {
  const ids = favoriteIds?.slice().sort() ?? null
  return useQuery({
    queryKey: qk.recipePage(page, pageSize, search, ids),
    queryFn: () => fetchRecipes(page, pageSize, search, ids),
    placeholderData: keepPreviousData,
  })
}
export function useFeaturedRecipes() {
  return useQuery({ queryKey: qk.featuredRecipes, queryFn: () => fetchFeaturedRecipes(5) })
}
export function useRecipe(id: string) {
  return useQuery({ queryKey: qk.recipe(id), queryFn: () => fetchRecipe(id), enabled: !!id })
}
export function useMealHistory(page = 0, pageSize = 24) {
  const { user } = useAuth()
  return useQuery({ queryKey: qk.historyPage(user?.id ?? '', page, pageSize), queryFn: () => fetchMealHistory(user!.id, page, pageSize), enabled: !!user, placeholderData: keepPreviousData })
}
export function useMealLog(id: string) {
  const { user } = useAuth()
  return useQuery({ queryKey: qk.mealLog(user?.id ?? '', id), queryFn: () => fetchMealLog(user!.id, id), enabled: !!user && !!id })
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
export function useSeedFoods() {
  return useQuery({ queryKey: qk.seedFoods, queryFn: fetchSeedFoods })
}
export function useFavorites() {
  const { user } = useAuth()
  return useQuery({
    queryKey: qk.favorites(user?.id ?? ''),
    queryFn: async () => new Set(await fetchFavoriteIds(user!.id)),
    enabled: !!user,
  })
}

export function useFoodFavorites() {
  const { user } = useAuth()
  return useQuery({
    queryKey: qk.foodFavorites(user?.id ?? ''),
    queryFn: () => fetchFoodFavorites(user!.id),
    enabled: !!user,
  })
}

export function useRecentFoods() {
  const { user } = useAuth()
  return useQuery({
    queryKey: qk.recentFoods(user?.id ?? ''),
    queryFn: () => fetchRecentFoods(user!.id),
    enabled: !!user,
  })
}

export function useSavedMeals() {
  const { user } = useAuth()
  return useQuery({
    queryKey: qk.savedMeals(user?.id ?? ''),
    queryFn: () => fetchSavedMeals(user!.id),
    enabled: !!user,
  })
}
