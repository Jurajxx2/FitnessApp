import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { qk } from './queries'
import { todayIso } from './date'

export type LogFoodInput = {
  name: string; amount: number; unit: string
  calories: number; protein_g: number; carbs_g: number; fat_g: number
}

export function useLogMeal() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ mealName, foods, notes }: { mealName: string; foods: LogFoodInput[]; notes?: string }) => {
      const { data: log, error: logErr } = await supabase
        .from('meal_logs')
        .insert({ user_id: user!.id, meal_name: mealName, logged_at: new Date().toISOString(), notes: notes ?? null, image_url: null })
        .select()
        .single()
      if (logErr) throw logErr
      const rows = foods.map(f => ({
        meal_log_id: (log as { id: string }).id,
        name: f.name,
        amount: f.amount,
        unit: f.unit,
        amount_grams: f.amount, // keep populated: legacy NOT NULL column
        calories: f.calories,
        protein_g: f.protein_g,
        carbs_g: f.carbs_g,
        fat_g: f.fat_g,
      }))
      const { error: foodErr } = await supabase.from('meal_log_foods').insert(rows)
      if (foodErr) {
        // No client-side transaction: compensate by deleting the just-created
        // parent row so a failed foods insert doesn't leave an orphaned,
        // phantom 0-kcal meal (or duplicates on retry). Do not swallow foodErr.
        await supabase.from('meal_logs').delete().eq('id', (log as { id: string }).id)
        throw foodErr
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.dailyLogs(user!.id, todayIso()) })
      qc.invalidateQueries({ queryKey: qk.history(user!.id) })
    },
  })
}

export function useToggleFavorite() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ recipeId, isFavorite }: { recipeId: string; isFavorite: boolean }) => {
      if (isFavorite) {
        const { error } = await supabase.from('recipe_favorites').delete()
          .eq('user_id', user!.id).eq('recipe_id', recipeId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('recipe_favorites')
          .upsert({ user_id: user!.id, recipe_id: recipeId })
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.favorites(user!.id) }),
  })
}
