import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { qk } from './queries'
import { todayIso } from './date'
import { removeMealPhoto, uploadMealPhoto } from '../lib/storage'

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

export function useDeleteMealLog() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ logId, imageUrl }: { logId: string; imageUrl: string | null }) => {
      const { error } = await supabase
        .from('meal_logs')
        .delete()
        .eq('id', logId)
        .eq('user_id', user!.id)
      if (error) throw error

      if (imageUrl) {
        // The database row is already gone; do not make a stale object prevent
        // the athlete from deleting their meal log.
        try {
          await removeMealPhoto(imageUrl)
        } catch {
          // Best-effort cleanup only.
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.history(user!.id) })
      qc.invalidateQueries({ queryKey: ['dailyLogs', user!.id] })
    },
  })
}

export function useUpdateMealLog() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ logId, mealName, foods, notes, photoFile, removePhoto, existingImageUrl }: {
      logId: string
      mealName: string
      foods: LogFoodInput[]
      notes?: string
      photoFile?: File | null
      removePhoto?: boolean
      existingImageUrl: string | null
    }): Promise<LogMealResult> => {
      const { error: updateError } = await supabase
        .from('meal_logs')
        .update({ meal_name: mealName, notes: notes ?? null })
        .eq('id', logId)
        .eq('user_id', user!.id)
      if (updateError) throw updateError

      const { error: deleteError } = await supabase
        .from('meal_log_foods')
        .delete()
        .eq('meal_log_id', logId)
      if (deleteError) throw deleteError

      const rows = foods.map(food => ({
        meal_log_id: logId,
        name: food.name,
        amount: food.amount,
        unit: food.unit,
        amount_grams: food.amount,
        calories: food.calories,
        protein_g: food.protein_g,
        carbs_g: food.carbs_g,
        fat_g: food.fat_g,
      }))
      const { error: insertError } = await supabase.from('meal_log_foods').insert(rows)
      if (insertError) throw insertError

      if (removePhoto && existingImageUrl && !photoFile) {
        const { error: clearPhotoError } = await supabase
          .from('meal_logs')
          .update({ image_url: null })
          .eq('id', logId)
          .eq('user_id', user!.id)
        if (clearPhotoError) throw clearPhotoError
        try {
          await removeMealPhoto(existingImageUrl)
        } catch {
          // The database reference is already cleared; stale storage can be
          // removed later without breaking the athlete's meal history.
        }
      }

      if (!photoFile) return { id: logId, photoAttached: false, photoError: null }

      try {
        // Keep the current image until the replacement has uploaded and its
        // database reference is durable, so a failed upload is non-destructive.
        const imageUrl = await uploadMealPhoto(user!.id, logId, photoFile, { upsert: true })
        const { error: photoUpdateError } = await supabase
          .from('meal_logs')
          .update({ image_url: imageUrl })
          .eq('id', logId)
          .eq('user_id', user!.id)
        if (photoUpdateError) throw photoUpdateError
        if (existingImageUrl && existingImageUrl !== imageUrl) {
          try {
            await removeMealPhoto(existingImageUrl)
          } catch {
            // The new image is already connected to the meal log.
          }
        }
        return { id: logId, photoAttached: true, photoError: null }
      } catch (error) {
        return {
          id: logId,
          photoAttached: false,
          photoError: error instanceof Error ? error.message : 'Photo upload failed',
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.history(user!.id) })
      qc.invalidateQueries({ queryKey: ['dailyLogs', user!.id] })
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
