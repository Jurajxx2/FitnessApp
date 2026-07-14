import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Lock, LockOpen, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Button, Card, ConfirmDialog, EditorPage, Input, useNotice, Shimmer, EmptyState } from '../../components/ui'
import { NutritionPreferencesForm } from '../../components/NutritionPreferencesForm'
import { useNutritionPreferences } from '../../nutrition/preferences'
import { generateWeek, KCAL_TOLERANCE, type GeneratedPlan, type GeneratedSlot, type GeneratorOptions, type GeneratorTarget } from '../../nutrition/generator'
import { deletePlan, fetchGeneratedPlan, fetchGeneratorPool, publishPlan, saveGeneratedPlan } from '../../nutrition/generationApi'
import type { NutritionTarget, UserNutritionPreferences } from '../../types/database'

const DAY_SHORTS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const SLOT_LABELS: Record<string, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' }

function optionsFromPreferences(preferences: UserNutritionPreferences, seed: number): GeneratorOptions {
  return {
    includeSnack: preferences.include_snack,
    mealDistribution: preferences.meal_distribution,
    dietaryPatterns: preferences.dietary_patterns,
    excludedAllergens: preferences.excluded_allergens,
    maxPrepTimeMin: preferences.max_prep_time_min,
    maxRecipeRepeatsPerWeek: preferences.max_recipe_repeats_per_week,
    favouriteRecipeIds: preferences.favourite_recipe_ids,
    seed,
  }
}

function deltaChip(value: number, target: number) {
  const pct = target > 0 ? (value - target) / target : 0
  const ok = Math.abs(pct) <= KCAL_TOLERANCE
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ok ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
      {pct >= 0 ? '+' : ''}{Math.round(pct * 100)}%
    </span>
  )
}

export default function GeneratePlan() {
  const { id: previewPlanId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify } = useNotice()
  const isPreview = Boolean(previewPlanId)

  const previewQuery = useQuery({
    queryKey: ['generated-plan', previewPlanId],
    enabled: isPreview,
    queryFn: () => fetchGeneratedPlan(previewPlanId!),
  })
  const userId = isPreview ? (previewQuery.data?.user_id ?? '') : (searchParams.get('user') ?? '')

  const targetQuery = useQuery<NutritionTarget | null>({
    queryKey: ['admin-nutrition-target', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_active_nutrition_target', { p_user_id: userId })
      if (error) throw error
      return (data as NutritionTarget[] | null)?.[0] ?? null
    },
  })
  const poolQuery = useQuery({ queryKey: ['generator-pool'], queryFn: fetchGeneratorPool })
  const preferencesQuery = useNutritionPreferences(userId)

  const [preferences, setPreferences] = useState<UserNutritionPreferences | null>(null)
  const [planName, setPlanName] = useState('')
  const [seed, setSeed] = useState(1)
  const [plan, setPlan] = useState<GeneratedPlan | null>(null)
  const [savedPlanId, setSavedPlanId] = useState<string | null>(previewPlanId ?? null)
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  useEffect(() => {
    if (preferencesQuery.data && !preferences) setPreferences(preferencesQuery.data)
  }, [preferencesQuery.data, preferences])
  useEffect(() => {
    if (isPreview && previewQuery.data) {
      setPlanName(previewQuery.data.name)
      setPlan(current => current ?? {
        days: previewQuery.data.days,
        score: previewQuery.data.score ?? 0,
        diagnostics: (previewQuery.data.diagnostics as GeneratedPlan['diagnostics']) ?? { poolSizePerSlot: {}, daysOutOfTolerance: [], notes: [] },
      })
    }
  }, [isPreview, previewQuery.data])
  useEffect(() => {
    if (!isPreview && !planName && targetQuery.data) {
      setPlanName(`Generated plan · ${new Date().toLocaleDateString('en-GB')}`)
    }
  }, [isPreview, planName, targetQuery.data])

  const target: GeneratorTarget | null = targetQuery.data
    ? { calories: targetQuery.data.calories, protein_g: targetQuery.data.protein_g, carbs_g: targetQuery.data.carbs_g, fat_g: targetQuery.data.fat_g }
    : null

  const lockedSlots = useMemo(() => {
    const map = new Map<string, GeneratedSlot>()
    plan?.days.forEach(day => day.slots.forEach(slot => { if (slot.locked) map.set(`${day.dayOfWeek}:${slot.slot}`, slot) }))
    return map
  }, [plan])

  function regenerate(newSeed: number, keepLocks: boolean) {
    if (!target || !preferences || !poolQuery.data) return
    setSeed(newSeed)
    setPlan(generateWeek(poolQuery.data, target, optionsFromPreferences(preferences, newSeed), keepLocks ? lockedSlots : undefined))
  }

  function toggleLock(dayOfWeek: number, slotType: string) {
    setPlan(current => current && ({
      ...current,
      days: current.days.map(day => day.dayOfWeek !== dayOfWeek ? day : ({
        ...day,
        slots: day.slots.map(slot => slot.slot === slotType ? { ...slot, locked: !slot.locked } : slot),
      })),
    }))
  }

  function swapSlot(dayOfWeek: number, slotType: string) {
    if (!target || !preferences || !poolQuery.data || !plan) return
    const nextSeed = seed + 1000 + dayOfWeek * 7
    setSeed(nextSeed)
    const locks = new Map(lockedSlots)
    // Lock everything except the slot being swapped, then regenerate.
    plan.days.forEach(day => day.slots.forEach(slot => {
      const key = `${day.dayOfWeek}:${slot.slot}`
      if (!(day.dayOfWeek === dayOfWeek && slot.slot === slotType)) locks.set(key, slot)
      else locks.delete(key)
    }))
    setPlan(generateWeek(poolQuery.data, target, optionsFromPreferences(preferences, nextSeed), locks))
  }

  const saveDraft = useMutation({
    mutationFn: async () => {
      if (!plan || !targetQuery.data || !userId) throw new Error('Nothing to save yet')
      return saveGeneratedPlan({ planId: savedPlanId, userId, name: planName, description: '', targetId: targetQuery.data.id, plan })
    },
    onSuccess: planId => {
      setSavedPlanId(planId)
      queryClient.invalidateQueries({ queryKey: ['meal-plans-admin'] })
      notify('Draft saved.')
    },
    onError: error => notify(`Couldn’t save draft: ${error.message}`, 'error'),
  })

  const publish = useMutation({
    mutationFn: async () => {
      const planId = savedPlanId ?? await saveDraft.mutateAsync()
      await publishPlan(userId, planId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-meal-plan', userId] })
      queryClient.invalidateQueries({ queryKey: ['meal-plans-admin'] })
      queryClient.invalidateQueries({ queryKey: ['mealPlan', userId] })
      notify('Plan published to the athlete.')
      navigate(`/admin/users/${userId}`)
    },
    onError: error => notify(`Couldn’t publish: ${error.message}`, 'error'),
  })

  const removeDraft = useMutation({
    mutationFn: async () => { if (savedPlanId) await deletePlan(savedPlanId) },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-plans-admin'] })
      notify('Draft deleted.')
      navigate('/admin/nutrition?tab=meal-plans')
    },
    onError: error => notify(`Couldn’t delete draft: ${error.message}`, 'error'),
  })

  if ((isPreview && previewQuery.isLoading) || targetQuery.isLoading || poolQuery.isLoading) {
    return <EditorPage backTo="/admin/nutrition?tab=meal-plans" backLabel="Back to meal plans" eyebrow="Generated nutrition" title="Loading…"><Shimmer className="h-96 w-full" /></EditorPage>
  }
  if (!userId || !target) {
    return (
      <EditorPage backTo="/admin/nutrition?tab=meal-plans" backLabel="Back to meal plans" eyebrow="Generated nutrition" title="Generate meal plan">
        <EmptyState title="No active macro target" description="Save macro goals for the athlete first, then generate a plan." />
      </EditorPage>
    )
  }

  const published = previewQuery.data?.generation_status === 'published'

  return (
    <EditorPage
      backTo={userId ? `/admin/users/${userId}` : '/admin/nutrition?tab=meal-plans'}
      backLabel="Back to athlete"
      eyebrow="Generated nutrition"
      title={isPreview ? planName || 'Generated plan' : 'Generate meal plan'}
      description="Deterministic draft built from the athlete's macro target and preferences. Swap or lock slots, regenerate, then publish."
      actions={
        <>
          {savedPlanId && !published && <Button variant="danger" onClick={() => setDeleteDialogOpen(true)}>Delete draft</Button>}
          <Button variant="ghost" onClick={() => regenerate(seed + 1, true)} disabled={!poolQuery.data?.length}>
            <RefreshCw size={15} /> Regenerate
          </Button>
          <Button variant="secondary" onClick={() => saveDraft.mutate()} loading={saveDraft.isPending} disabled={!plan || published}>Save draft</Button>
          <Button onClick={() => setPublishDialogOpen(true)} disabled={!plan || published} loading={publish.isPending}>
            {published ? 'Published' : 'Publish to athlete'}
          </Button>
        </>
      }
      aside={
        <>
          <Card>
            <h2 className="text-sm font-bold text-text-primary">Athlete target</h2>
            <div className="mt-3 divide-y divide-outline-subtle text-sm">
              <div className="flex justify-between py-2"><span className="text-text-secondary">Calories</span><span className="font-semibold text-text-primary">{Math.round(target.calories)}</span></div>
              <div className="flex justify-between py-2"><span className="text-text-secondary">Protein</span><span className="font-semibold text-text-primary">{Math.round(target.protein_g)}g</span></div>
              <div className="flex justify-between py-2"><span className="text-text-secondary">Carbs</span><span className="font-semibold text-text-primary">{Math.round(target.carbs_g)}g</span></div>
              <div className="flex justify-between py-2"><span className="text-text-secondary">Fat</span><span className="font-semibold text-text-primary">{Math.round(target.fat_g)}g</span></div>
            </div>
          </Card>
          {plan && (
            <Card>
              <h2 className="text-sm font-bold text-text-primary">Diagnostics</h2>
              <p className="mt-2 text-xs text-text-secondary">Plan score (mean kcal deviation): {(plan.score * 100).toFixed(1)}%</p>
              <ul className="mt-2 space-y-1 text-xs text-text-secondary">
                {Object.entries(plan.diagnostics.poolSizePerSlot).map(([slot, size]) => (
                  <li key={slot}>{SLOT_LABELS[slot] ?? slot}: {size} eligible recipes</li>
                ))}
              </ul>
              {plan.diagnostics.notes.map(note => <p key={note} className="mt-2 text-xs text-warning">{note}</p>)}
            </Card>
          )}
        </>
      }
    >
      {!isPreview && preferences && (
        <Card className="p-5">
          <h2 className="mb-1 text-sm font-bold text-text-primary">Generation options</h2>
          <p className="mb-4 text-xs text-text-secondary">Prefilled from the athlete's preferences. Changes here apply to this run only.</p>
          <NutritionPreferencesForm value={preferences} onChange={setPreferences} locale="en" />
          <div className="mt-4 flex items-end gap-3">
            <Input label="Plan name" value={planName} onChange={event => setPlanName(event.target.value)} className="flex-1" />
            <Button onClick={() => regenerate(seed, false)} disabled={!poolQuery.data?.length}>Generate</Button>
          </div>
          {!poolQuery.data?.length && <p className="mt-3 text-sm text-error">No generator-ready recipes exist. Mark recipes as eligible with verified macros first.</p>}
        </Card>
      )}

      {plan && (
        <div className="grid gap-3 overflow-x-auto pb-2 lg:grid-cols-7">
          {plan.days.map(day => (
            <Card key={day.dayOfWeek} className="min-w-44 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">{DAY_SHORTS[day.dayOfWeek]}</p>
                {deltaChip(day.totals.calories, target.calories)}
              </div>
              <div className="space-y-2">
                {day.slots.map(slot => (
                  <div key={slot.slot} className={`rounded-xl border p-2 ${slot.locked ? 'border-accent bg-accent/5' : 'border-outline-subtle bg-surface'}`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">{SLOT_LABELS[slot.slot]}</p>
                    <p className="mt-1 line-clamp-2 text-xs font-semibold text-text-primary">{slot.recipeName}</p>
                    <p className="mt-1 text-[11px] text-text-secondary">{slot.portionMultiplier !== 1 && `${slot.portionMultiplier}× · `}{Math.round(slot.calories)} kcal · P {Math.round(slot.protein_g)}g</p>
                    {!isPreview && !published && (
                      <div className="mt-2 flex gap-1">
                        <button type="button" aria-label={`Swap ${SLOT_LABELS[slot.slot]} on ${DAY_SHORTS[day.dayOfWeek]}`} onClick={() => swapSlot(day.dayOfWeek, slot.slot)} className="min-h-7 flex-1 cursor-pointer rounded-lg border border-outline bg-transparent text-[10px] font-semibold text-text-secondary hover:text-text-primary">Swap</button>
                        <button type="button" aria-label={`${slot.locked ? 'Unlock' : 'Lock'} ${SLOT_LABELS[slot.slot]} on ${DAY_SHORTS[day.dayOfWeek]}`} onClick={() => toggleLock(day.dayOfWeek, slot.slot)} className="flex min-h-7 w-8 cursor-pointer items-center justify-center rounded-lg border border-outline bg-transparent text-text-secondary hover:text-text-primary">
                          {slot.locked ? <Lock size={11} /> : <LockOpen size={11} />}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2 border-t border-outline-subtle pt-2 text-[11px] text-text-secondary">
                {Math.round(day.totals.calories)} kcal · P {Math.round(day.totals.protein_g)}g · C {Math.round(day.totals.carbs_g)}g · F {Math.round(day.totals.fat_g)}g
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={publishDialogOpen}
        title="Publish this plan to the athlete?"
        description="It replaces the athlete's current meal plan. The previous plan stays in assignment history."
        pending={publish.isPending}
        onClose={() => setPublishDialogOpen(false)}
        onConfirm={() => { setPublishDialogOpen(false); publish.mutate() }}
      />
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete this generated draft?"
        description="The draft and its meals are permanently removed."
        pending={removeDraft.isPending}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={() => removeDraft.mutate()}
      />
    </EditorPage>
  )
}
