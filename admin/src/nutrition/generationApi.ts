import { supabase } from '../lib/supabase'
import type { NutritionTarget } from '../types/database'
import type { GeneratedDay, GeneratedPlan, GeneratedSlot, GeneratorRecipe, SlotType } from './generator'

const SLOT_ORDER: SlotType[] = ['breakfast', 'lunch', 'snack', 'dinner']

export async function fetchGeneratorPool(): Promise<GeneratorRecipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select('id, name, calories, protein_g, carbs_g, fat_g, fiber_g, prep_time_min, cook_time_min, meal_types, dietary_patterns, allergens, is_active, eligible_for_generator, macros_verified, is_scalable, allowed_portions')
    .order('id')
  if (error) throw error
  return (data ?? []).map(row => ({ ...row, allowed_portions: row.allowed_portions?.map(Number) ?? null })) as GeneratorRecipe[]
}

export function serializeGeneratedPlanDays(plan: GeneratedPlan) {
  return plan.days.map(day => ({
    day_of_week: day.dayOfWeek,
    meals: day.slots.map(slot => {
      if (!Number.isFinite(slot.portionMultiplier) || slot.portionMultiplier <= 0) {
        throw new Error(`Invalid portion multiplier for ${slot.recipeName || slot.recipeId}`)
      }
      return {
        meal_type: slot.slot,
        recipes: [{
          recipe_id: slot.recipeId,
          portion_multiplier: slot.portionMultiplier,
          snapshot_recipe_name: slot.recipeName,
          snapshot_calories: slot.calories,
          snapshot_protein_g: slot.protein_g,
          snapshot_carbs_g: slot.carbs_g,
          snapshot_fat_g: slot.fat_g,
          snapshot_fiber_g: slot.fiber_g,
        }],
      }
    }),
  }))
}

export function serializeGeneratedPlanAsManualMeals(plan: GeneratedPlan) {
  return plan.days.flatMap(day => day.slots.map(slot => {
    if (!Number.isFinite(slot.portionMultiplier) || slot.portionMultiplier <= 0) {
      throw new Error(`Invalid portion multiplier for ${slot.recipeName || slot.recipeId}`)
    }
    return {
      day_of_week: day.dayOfWeek,
      meal_type: slot.slot,
      recipes: [{
        recipe_id: slot.recipeId,
        portion_multiplier: slot.portionMultiplier,
      }],
    }
  }))
}

export async function saveGeneratedPlanToLibrary(input: {
  name: string
  description: string
  plan: GeneratedPlan
}): Promise<string> {
  const { data, error } = await supabase.rpc('admin_save_manual_meal_plan_v2', {
    p_plan_id: null,
    p_name: input.name,
    p_description: input.description,
    p_meals: serializeGeneratedPlanAsManualMeals(input.plan),
    p_preserved_meal_ids: [],
    p_assigned_user_ids: [],
  })
  if (error) throw error
  return data as string
}

export async function saveGeneratedPlan(input: {
  planId: string | null; userId: string; name: string; description: string; targetId: string; plan: GeneratedPlan
}): Promise<string> {
  const days = serializeGeneratedPlanDays(input.plan)
  const { data, error } = await supabase.rpc('admin_save_generated_meal_plan', {
    p_plan_id: input.planId,
    p_user_id: input.userId,
    p_name: input.name,
    p_description: input.description,
    p_target_id: input.targetId,
    p_days: days,
    p_score: input.plan.score,
    p_diagnostics: input.plan.diagnostics,
  })
  if (error) throw error
  return data as string
}

/** Persist the exact plan being reviewed before making it the athlete's current plan. */
export async function persistCurrentPlanThenPublish(
  plan: GeneratedPlan,
  savePlan: (currentPlan: GeneratedPlan) => Promise<string>,
  publishSavedPlan: (planId: string) => Promise<void>,
): Promise<string> {
  const planId = await savePlan(plan)
  await publishSavedPlan(planId)
  return planId
}

interface PlanRecipeRow {
  meal_type: SlotType | null; day_of_week: number | null
  recipe_id: string | null; portion_multiplier: number
  snapshot_recipe_name: string | null; snapshot_calories: number | null
  snapshot_protein_g: number | null; snapshot_carbs_g: number | null; snapshot_fat_g: number | null
  snapshot_fiber_g: number | null
}

export interface GeneratedPlanRecord {
  id: string; user_id: string | null; name: string; description: string | null
  generation_status: string | null; nutrition_target_id: string | null; target_version: number | null
  score: number | null; diagnostics: unknown
  days: GeneratedDay[]
}

export async function fetchGeneratedPlan(planId: string): Promise<GeneratedPlanRecord> {
  const { data, error } = await supabase
    .from('meal_plans')
    .select('id, user_id, name, description, generation_status, nutrition_target_id, target_version, score, diagnostics, meal_plan_recipes(meal_type, day_of_week, recipe_id, portion_multiplier, snapshot_recipe_name, snapshot_calories, snapshot_protein_g, snapshot_carbs_g, snapshot_fat_g, snapshot_fiber_g)')
    .eq('id', planId)
    .single()
  if (error) throw error

  const rows = ((data.meal_plan_recipes ?? []) as PlanRecipeRow[])
    .filter(row => row.day_of_week != null && row.meal_type != null && row.recipe_id != null)
  const days: GeneratedDay[] = Array.from({ length: 7 }, (_, dayOfWeek) => {
    const slots: GeneratedSlot[] = rows
      .filter(row => row.day_of_week === dayOfWeek)
      .map(row => ({
        slot: row.meal_type!, recipeId: row.recipe_id!, recipeName: row.snapshot_recipe_name ?? '',
        portionMultiplier: Number(row.portion_multiplier), locked: false,
        calories: row.snapshot_calories ?? 0, protein_g: row.snapshot_protein_g ?? 0,
        carbs_g: row.snapshot_carbs_g ?? 0, fat_g: row.snapshot_fat_g ?? 0,
        fiber_g: row.snapshot_fiber_g,
      }))
      .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot))
    const totals = slots.reduce(
      (acc, slot) => ({
        calories: acc.calories + slot.calories, protein_g: acc.protein_g + slot.protein_g,
        carbs_g: acc.carbs_g + slot.carbs_g, fat_g: acc.fat_g + slot.fat_g,
      }),
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    )
    return { dayOfWeek, slots, totals, withinTolerance: true }
  })
  return {
    id: data.id, user_id: data.user_id, name: data.name, description: data.description,
    generation_status: data.generation_status, nutrition_target_id: data.nutrition_target_id,
    target_version: data.target_version, score: data.score, diagnostics: data.diagnostics, days,
  }
}

export async function fetchNutritionTargetVersion(targetId: string, targetVersion: number): Promise<NutritionTarget | null> {
  const { data, error } = await supabase
    .from('nutrition_targets')
    .select('*')
    .eq('id', targetId)
    .eq('version', targetVersion)
    .maybeSingle()
  if (error) throw error
  return (data as NutritionTarget | null) ?? null
}

export async function publishPlan(userId: string, planId: string): Promise<void> {
  const { error } = await supabase.rpc('publish_meal_plan', { p_user_id: userId, p_meal_plan_id: planId })
  if (error) throw error
}

export async function deletePlan(planId: string): Promise<void> {
  const { data, error } = await supabase.rpc('admin_delete_generated_meal_plan', { p_plan_id: planId })
  if (error) throw error
  if (data !== planId) throw new Error('Generated draft deletion did not confirm deletion')
}
