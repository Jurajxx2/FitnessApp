import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { UserNutritionPreferences } from '../types/database'

export function defaultPreferences(userId: string): UserNutritionPreferences {
  return {
    user_id: userId,
    dietary_patterns: [],
    excluded_allergens: [],
    disliked_recipe_ids: [],
    favourite_recipe_ids: [],
    meals_per_day: 3,
    include_snack: false,
    meal_distribution: null,
    max_prep_time_min: null,
    max_recipe_repeats_per_week: 2,
    updated_at: new Date().toISOString(),
  }
}

export async function fetchNutritionPreferences(userId: string): Promise<UserNutritionPreferences | null> {
  const { data, error } = await supabase
    .from('user_nutrition_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as UserNutritionPreferences | null) ?? null
}

export function useNutritionPreferences(userId: string) {
  return useQuery({
    queryKey: ['nutrition-preferences', userId],
    queryFn: async () => (await fetchNutritionPreferences(userId)) ?? defaultPreferences(userId),
    enabled: Boolean(userId),
  })
}

export function useSaveNutritionPreferences(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (value: UserNutritionPreferences) => {
      const { updated_at: _ignored, ...row } = value
      const { error } = await supabase
        .from('user_nutrition_preferences')
        .upsert({ ...row, user_id: userId, updated_at: new Date().toISOString() })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nutrition-preferences', userId] }),
  })
}
