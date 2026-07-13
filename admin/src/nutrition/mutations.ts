import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { qk } from './queries'
import { todayIso } from './date'
import { uploadMealPhoto } from '../lib/storage'

export type LogFoodInput = {
  name: string; amount: number; unit: string
  calories: number; protein_g: number; carbs_g: number; fat_g: number
}

export type LogMealResult = {
  id: string
  photoAttached: boolean
  photoError: string | null
}

export function useLogMeal() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ mealName, foods, notes, photoFile }: { mealName: string; foods: LogFoodInput[]; notes?: string; photoFile?: File | null }): Promise<LogMealResult> => {
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

      const logId = (log as { id: string }).id
      if (!photoFile) return { id: logId, photoAttached: false, photoError: null }

      try {
        const imageUrl = await uploadMealPhoto(user!.id, logId, photoFile)
        const { error: photoUpdateError } = await supabase
          .from('meal_logs')
          .update({ image_url: imageUrl })
          .eq('id', logId)
          .eq('user_id', user!.id)
        if (photoUpdateError) throw photoUpdateError
        return { id: logId, photoAttached: true, photoError: null }
      } catch (error) {
        // The meal itself is already safely logged. Return a partial-success
        // result so the UI does not encourage a retry that would duplicate it.
        return {
          id: logId,
          photoAttached: false,
          photoError: error instanceof Error ? error.message : 'Photo upload failed',
        }
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
