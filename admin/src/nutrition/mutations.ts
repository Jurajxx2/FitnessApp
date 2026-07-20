import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { MealType } from '../types/database'
import { qk } from './queries'
import { amountGrams, type LogFoodInput } from './logDraft'
import { removeMealPhoto, uploadMealPhoto } from '../lib/storage'

export type { LogFoodInput } from './logDraft'

export type LogMealResult = {
  id: string
  photoAttached: boolean
  photoError: string | null
}

type CreateMealInput = {
  mealName: string
  mealType: MealType
  loggedAt: string
  foods: LogFoodInput[]
  notes?: string
  photoFile?: File | null
}

type UpdateMealInput = {
  logId: string
  mealName: string
  mealType: MealType | null
  loggedAt: string
  foods: LogFoodInput[]
  notes?: string
  photoFile?: File | null
  removePhoto?: boolean
  existingImageUrl: string | null
}

function rpcItems(foods: LogFoodInput[]) {
  return foods.map(food => ({
    name: food.name,
    amount: food.amount,
    unit: food.unit,
    amount_grams: amountGrams(food.amount, food.unit),
    calories: food.calories,
    protein_g: food.protein_g,
    carbs_g: food.carbs_g,
    fat_g: food.fat_g,
  }))
}

async function saveMealLogAtomic(input: {
  logId: string | null
  mealName: string
  mealType: MealType | null
  loggedAt: string
  foods: LogFoodInput[]
  notes?: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('save_meal_log', {
    p_meal_log_id: input.logId,
    p_meal_name: input.mealName,
    p_meal_type: input.mealType,
    p_logged_at: input.loggedAt,
    p_notes: input.notes ?? null,
    p_items: rpcItems(input.foods),
  })
  if (error) throw error
  if (typeof data !== 'string' || !data) throw new Error('Meal log RPC returned no id')
  return data
}

async function attachPhoto(
  userId: string,
  logId: string,
  photoFile: File,
): Promise<{ result: LogMealResult; imagePath: string | null }> {
  try {
    const imagePath = await uploadMealPhoto(userId, logId, photoFile, { upsert: true })
    const { error } = await supabase
      .from('meal_logs')
      .update({ image_url: imagePath })
      .eq('id', logId)
      .eq('user_id', userId)
    if (error) throw error
    return { result: { id: logId, photoAttached: true, photoError: null }, imagePath }
  } catch (error) {
    return {
      result: {
        id: logId,
        photoAttached: false,
        photoError: error instanceof Error ? error.message : 'Photo upload failed',
      },
      imagePath: null,
    }
  }
}

function invalidateMealQueries(queryClient: ReturnType<typeof useQueryClient>, userId: string) {
  queryClient.invalidateQueries({ queryKey: qk.history(userId) })
  queryClient.invalidateQueries({ queryKey: ['dailyLogs', userId] })
  queryClient.invalidateQueries({ queryKey: qk.recentFoods(userId) })
}

export function useLogMeal() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateMealInput): Promise<LogMealResult> => {
      const logId = await saveMealLogAtomic({ ...input, logId: null })
      if (!input.photoFile) return { id: logId, photoAttached: false, photoError: null }
      return (await attachPhoto(user!.id, logId, input.photoFile)).result
    },
    onSuccess: () => invalidateMealQueries(queryClient, user!.id),
  })
}

export function useDeleteMealLog() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ logId, imageUrl }: { logId: string; imageUrl: string | null }) => {
      const { error } = await supabase
        .from('meal_logs')
        .delete()
        .eq('id', logId)
        .eq('user_id', user!.id)
      if (error) throw error

      if (imageUrl) {
        try {
          await removeMealPhoto(imageUrl)
        } catch {
          // The database row is already gone. Storage cleanup is best effort.
        }
      }
    },
    onSuccess: () => invalidateMealQueries(queryClient, user!.id),
  })
}

export function useUpdateMealLog() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateMealInput): Promise<LogMealResult> => {
      const logId = await saveMealLogAtomic({ ...input, logId: input.logId })

      if (input.removePhoto && input.existingImageUrl && !input.photoFile) {
        const { error } = await supabase
          .from('meal_logs')
          .update({ image_url: null })
          .eq('id', logId)
          .eq('user_id', user!.id)
        if (error) throw error
        try {
          await removeMealPhoto(input.existingImageUrl)
        } catch {
          // The durable reference is cleared; stale object cleanup can retry later.
        }
      }

      if (!input.photoFile) return { id: logId, photoAttached: false, photoError: null }
      const attached = await attachPhoto(user!.id, logId, input.photoFile)
      if (attached.result.photoAttached && input.existingImageUrl && input.existingImageUrl !== attached.imagePath) {
        try {
          await removeMealPhoto(input.existingImageUrl)
        } catch {
          // The replacement is already durable.
        }
      }
      return attached.result
    },
    onSuccess: () => invalidateMealQueries(queryClient, user!.id),
  })
}

export function useToggleFavorite() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.favorites(user!.id) }),
  })
}

export function useSaveFoodFavorite() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (food: LogFoodInput) => {
      const { error } = await supabase.from('food_favorites').upsert({
        user_id: user!.id,
        name: food.name.trim(),
        amount: food.amount,
        unit: food.amount == null ? null : (food.unit?.trim() || 'g'),
        amount_grams: amountGrams(food.amount, food.unit),
        calories: food.calories,
        protein_g: food.protein_g,
        carbs_g: food.carbs_g,
        fat_g: food.fat_g,
      }, { onConflict: 'user_id,name' })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.foodFavorites(user!.id) }),
  })
}

export function useDeleteFoodFavorite() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (favoriteId: string) => {
      const { error } = await supabase.from('food_favorites').delete()
        .eq('id', favoriteId).eq('user_id', user!.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.foodFavorites(user!.id) }),
  })
}

export function useSaveMealTemplate() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, foods }: { name: string; foods: LogFoodInput[] }) => {
      if (!name.trim() || foods.length === 0) throw new Error('Saved meal requires a name and at least one item')
      const { data, error } = await supabase.rpc('save_saved_meal', {
        p_name: name.trim(),
        p_items: rpcItems(foods),
      })
      if (error) throw error
      if (typeof data !== 'string' || !data) throw new Error('Saved meal RPC returned no id')
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.savedMeals(user!.id) }),
  })
}

export function useDeleteMealTemplate() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (savedMealId: string) => {
      const { error } = await supabase.from('saved_meals').delete()
        .eq('id', savedMealId).eq('user_id', user!.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.savedMeals(user!.id) }),
  })
}
