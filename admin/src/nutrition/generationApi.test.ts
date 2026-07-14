import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import type { NutritionTarget } from '../types/database'
import type { GeneratedPlan } from './generator'
import { deletePlan, fetchGeneratedPlan, fetchGeneratorPool, fetchNutritionTargetVersion, persistCurrentPlanThenPublish, serializeGeneratedPlanDays } from './generationApi'

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }))

beforeEach(() => {
  vi.mocked(supabase.from).mockReset()
  vi.mocked(supabase.rpc).mockReset()
})

describe('persistCurrentPlanThenPublish', () => {
  it('saves the current in-memory plan before publishing the returned draft id', async () => {
    const events: string[] = []
    const currentPlan = {
      days: [{
        dayOfWeek: 0,
        slots: [{
          slot: 'breakfast', recipeId: 'current-recipe', recipeName: 'Current recipe', portionMultiplier: 1.5,
          calories: 450, protein_g: 30, carbs_g: 50, fat_g: 12, fiber_g: 6, locked: false,
        }],
        totals: { calories: 450, protein_g: 30, carbs_g: 50, fat_g: 12 },
        withinTolerance: true,
      }],
      score: 0,
      diagnostics: { poolSizePerSlot: { breakfast: 4 }, daysOutOfTolerance: [], notes: [] },
    } satisfies GeneratedPlan
    const savePlan = vi.fn(async (plan: GeneratedPlan) => {
      events.push(`save:${plan.days[0].slots[0].recipeId}`)
      return 'existing-draft-id'
    })
    const publishPlan = vi.fn(async (planId: string) => {
      events.push(`publish:${planId}`)
    })

    await persistCurrentPlanThenPublish(currentPlan, savePlan, publishPlan)

    expect(savePlan).toHaveBeenCalledWith(currentPlan)
    expect(publishPlan).toHaveBeenCalledWith('existing-draft-id')
    expect(events).toEqual(['save:current-recipe', 'publish:existing-draft-id'])
  })
})

describe('serializeGeneratedPlanDays', () => {
  const plan = {
    days: [{
      dayOfWeek: 0,
      slots: [{
        slot: 'breakfast', recipeId: 'recipe-1', recipeName: 'Scaled breakfast', portionMultiplier: 1.5,
        calories: 450, protein_g: 30, carbs_g: 51, fat_g: 12, fiber_g: 6, locked: false,
      }],
      totals: { calories: 450, protein_g: 30, carbs_g: 51, fat_g: 12 },
      withinTolerance: true,
    }],
    score: 0,
    diagnostics: { poolSizePerSlot: {}, daysOutOfTolerance: [], notes: [] },
  } satisfies GeneratedPlan

  it('sends the exact reviewed scaled snapshot for optimistic database validation', () => {
    expect(serializeGeneratedPlanDays(plan)[0].meals[0].recipes[0]).toEqual({
      recipe_id: 'recipe-1',
      portion_multiplier: 1.5,
      snapshot_recipe_name: 'Scaled breakfast',
      snapshot_calories: 450,
      snapshot_protein_g: 30,
      snapshot_carbs_g: 51,
      snapshot_fat_g: 12,
      snapshot_fiber_g: 6,
    })
  })

  it('rejects non-positive portions before calling the persistence RPC', () => {
    const invalid = structuredClone(plan)
    invalid.days[0].slots[0].portionMultiplier = 0
    expect(() => serializeGeneratedPlanDays(invalid)).toThrow('Invalid portion multiplier')
  })
})

describe('fetchGeneratorPool', () => {
  it('requests a stable recipe-id order', async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null })
    const select = vi.fn().mockReturnValue({ order })
    vi.mocked(supabase.from).mockReturnValue({ select } as never)

    await fetchGeneratorPool()

    expect(select).toHaveBeenCalledWith(expect.stringContaining('is_active, eligible_for_generator, macros_verified'))
    expect(order).toHaveBeenCalledWith('id')
  })
})

describe('generated-plan target snapshots', () => {
  it('returns the nutrition target id and version stored on the generated plan', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'plan-1', user_id: 'athlete-1', name: 'Saved plan', description: null,
        generation_status: 'draft', nutrition_target_id: 'target-1', target_version: 3,
        score: 0, diagnostics: {}, meal_plan_recipes: [],
      },
      error: null,
    })
    const eq = vi.fn().mockReturnValue({ single })
    const select = vi.fn().mockReturnValue({ eq })
    vi.mocked(supabase.from).mockReturnValue({ select } as never)

    const result = await fetchGeneratedPlan('plan-1')

    expect(select).toHaveBeenCalledWith(expect.stringContaining('nutrition_target_id, target_version'))
    expect(result).toMatchObject({ nutrition_target_id: 'target-1', target_version: 3 })
  })

  it('maps the persisted scaled fiber snapshot into the reviewed slot', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'plan-1', user_id: 'athlete-1', name: 'Saved plan', description: null,
        generation_status: 'draft', nutrition_target_id: 'target-1', target_version: 3,
        score: 0, diagnostics: {},
        meal_plan_recipes: [{
          meal_type: 'breakfast', day_of_week: 0, recipe_id: 'recipe-1', portion_multiplier: 1.5,
          snapshot_recipe_name: 'Breakfast', snapshot_calories: 450, snapshot_protein_g: 30,
          snapshot_carbs_g: 51, snapshot_fat_g: 12, snapshot_fiber_g: 6,
        }],
      },
      error: null,
    })
    const eq = vi.fn().mockReturnValue({ single })
    const select = vi.fn().mockReturnValue({ eq })
    vi.mocked(supabase.from).mockReturnValue({ select } as never)

    const result = await fetchGeneratedPlan('plan-1')

    expect(select).toHaveBeenCalledWith(expect.stringContaining('snapshot_fiber_g'))
    expect(result.days[0].slots[0]).toMatchObject({ portionMultiplier: 1.5, fiber_g: 6 })
  })

  it('loads the exact historical target version without requiring it to be active', async () => {
    const historicalTarget = {
      id: 'target-1', user_id: 'athlete-1', source: 'admin', created_by: 'coach-1',
      calories: 2100, protein_g: 160, carbs_g: 220, fat_g: 65, fiber_g_min: 30,
      calorie_tol_pct: 5, protein_tol_pct: 10, carbs_tol_pct: 15, fat_tol_pct: 15,
      version: 3, is_locked: true, effective_from: '2026-06-01T00:00:00Z',
      effective_to: '2026-07-01T00:00:00Z', created_at: '2026-06-01T00:00:00Z',
    } satisfies NutritionTarget
    const maybeSingle = vi.fn().mockResolvedValue({ data: historicalTarget, error: null })
    const versionEq = vi.fn().mockReturnValue({ maybeSingle })
    const idEq = vi.fn().mockReturnValue({ eq: versionEq })
    const select = vi.fn().mockReturnValue({ eq: idEq })
    vi.mocked(supabase.from).mockReturnValue({ select } as never)

    const result = await fetchNutritionTargetVersion('target-1', 3)

    expect(supabase.from).toHaveBeenCalledWith('nutrition_targets')
    expect(idEq).toHaveBeenCalledWith('id', 'target-1')
    expect(versionEq).toHaveBeenCalledWith('version', 3)
    expect(result).toEqual(historicalTarget)
  })
})

describe('deletePlan', () => {
  it('deletes a generated draft through the guarded RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'draft-1', error: null } as never)

    await deletePlan('draft-1')

    expect(supabase.rpc).toHaveBeenCalledWith('admin_delete_generated_meal_plan', { p_plan_id: 'draft-1' })
  })

  it('rejects a successful response that does not confirm the deleted id', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never)

    await expect(deletePlan('draft-1')).rejects.toThrow('did not confirm deletion')
  })
})
