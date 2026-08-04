import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Lock, LockOpen, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { NutritionPreferencesForm } from '../../components/NutritionPreferencesForm'
import { Button, Card, ConfirmDialog, EditorPage, Input, useNotice, Shimmer, EmptyState } from '../../components/ui'
import { useNutritionPreferences } from '../../nutrition/preferences'
import { generateWeek, isWithinTargetTolerances, swapGeneratedSlot, type GeneratedPlan, type GeneratedSlot, type GeneratorOptions, type GeneratorTarget } from '../../nutrition/generator'
import { deletePlan, fetchGeneratedPlan, fetchGeneratorPool, fetchNutritionTargetVersion, persistCurrentPlanThenPublish, publishPlan, saveGeneratedPlan, saveGeneratedPlanToLibrary } from '../../nutrition/generationApi'
import { combineReadiness, getGeneratedPlanActionState, getGenerationReadiness, getPublishReadiness, isGeneratorGuardrailsApproved } from '../../nutrition/generationReadiness'
import type { NutritionTarget, Profile, UserNutritionPreferences } from '../../types/database'

const DAY_SHORTS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const SLOT_LABELS: Record<string, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' }
const GENERATOR_GUARDRAILS_APPROVED = isGeneratorGuardrailsApproved(import.meta.env.VITE_MEAL_PLAN_GENERATOR_GUARDRAILS_APPROVED)

const DEFAULT_MANUAL_TARGET: GeneratorTarget = {
  calories: 2_000,
  protein_g: 150,
  carbs_g: 220,
  fat_g: 65,
  calorie_tol_pct: 5,
  protein_tol_pct: 10,
  carbs_tol_pct: 15,
  fat_tol_pct: 15,
}

function defaultManualPreferences(): UserNutritionPreferences {
  return {
    user_id: '',
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

function numberInputValue(value: number): string {
  return Number.isFinite(value) ? String(value) : ''
}

function numberFromInput(value: string): number {
  return value === '' ? Number.NaN : Number(value)
}

function roundedTargetValue(value: number, suffix = ''): string {
  return Number.isFinite(value) ? `${Math.round(value)}${suffix}` : '—'
}

function optionsFromPreferences(preferences: UserNutritionPreferences, seed: number): GeneratorOptions {
  return {
    includeSnack: preferences.include_snack,
    mealDistribution: preferences.meal_distribution,
    dietaryPatterns: preferences.dietary_patterns,
    excludedAllergens: preferences.excluded_allergens,
    maxPrepTimeMin: preferences.max_prep_time_min,
    maxRecipeRepeatsPerWeek: preferences.max_recipe_repeats_per_week,
    dislikedRecipeIds: preferences.disliked_recipe_ids,
    favouriteRecipeIds: preferences.favourite_recipe_ids,
    seed,
  }
}

// Shows the day's calorie delta, but colours by whether the WHOLE day (calories, protein, carbs,
// fat) is within tolerance — a day that hits calories yet misses carbs/fat is publish-blocked, so
// it must not read as green here.
function deltaChip(value: number, target: number, withinDayTolerance: boolean) {
  const pct = target > 0 ? (value - target) / target : 0
  return (
    <span
      title={withinDayTolerance ? 'Day is within all target tolerances' : 'Day is outside target tolerances (calories, protein, carbs, or fat)'}
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${withinDayTolerance ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}
    >
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
  const previewTargetId = previewQuery.data?.nutrition_target_id ?? ''
  const previewTargetVersion = previewQuery.data?.target_version ?? null
  const isStandalone = !isPreview && !userId

  const targetQuery = useQuery<NutritionTarget | null>({
    queryKey: isPreview
      ? ['generated-plan-target', previewTargetId, previewTargetVersion]
      : ['admin-nutrition-target', userId],
    enabled: isPreview
      ? Boolean(previewTargetId && previewTargetVersion != null)
      : Boolean(userId),
    queryFn: async () => {
      if (isPreview) {
        if (!previewTargetId || previewTargetVersion == null) return null
        return fetchNutritionTargetVersion(previewTargetId, previewTargetVersion)
      }
      const { data, error } = await supabase.rpc('get_active_nutrition_target', { p_user_id: userId })
      if (error) throw error
      return (data as NutritionTarget[] | null)?.[0] ?? null
    },
  })
  const athletesQuery = useQuery<Pick<Profile, 'id' | 'email' | 'full_name'>[]>({
    queryKey: ['generator-athletes'],
    enabled: !isPreview && !userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('is_admin', false)
        .eq('is_blocked', false)
        .order('full_name')
      if (error) throw error
      return data ?? []
    },
  })
  const poolQuery = useQuery({ queryKey: ['generator-pool'], queryFn: fetchGeneratorPool })
  const preferencesQuery = useNutritionPreferences(userId)

  const [planName, setPlanName] = useState('')
  const [planDescription, setPlanDescription] = useState('')
  const [seed, setSeed] = useState(1)
  const [plan, setPlan] = useState<GeneratedPlan | null>(null)
  const [manualTarget, setManualTarget] = useState<GeneratorTarget>(DEFAULT_MANUAL_TARGET)
  const [manualPreferences, setManualPreferences] = useState<UserNutritionPreferences>(defaultManualPreferences)
  const [savedPlanId, setSavedPlanId] = useState<string | null>(previewPlanId ?? null)
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [libraryPublishDialogOpen, setLibraryPublishDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  useEffect(() => {
    if (isPreview && previewQuery.data) {
      setPlanName(previewQuery.data.name)
      setPlanDescription(previewQuery.data.description ?? '')
      setPlan(current => current ?? {
        days: previewQuery.data.days,
        score: previewQuery.data.score ?? 0,
        diagnostics: (previewQuery.data.diagnostics as GeneratedPlan['diagnostics']) ?? { poolSizePerSlot: {}, daysOutOfTolerance: [], notes: [] },
      })
    }
  }, [isPreview, previewQuery.data])
  useEffect(() => {
    if (!isPreview && !planName && (targetQuery.data || isStandalone)) {
      setPlanName(`Generated plan · ${new Date().toLocaleDateString('en-GB')}`)
    }
  }, [isPreview, isStandalone, planName, targetQuery.data])
  useEffect(() => {
    if (!isPreview) {
      setPlan(null)
      setSavedPlanId(null)
      setSeed(1)
    }
  }, [isPreview, userId])

  const target: GeneratorTarget | null = targetQuery.data
    ? {
        calories: targetQuery.data.calories,
        protein_g: targetQuery.data.protein_g,
        carbs_g: targetQuery.data.carbs_g,
        fat_g: targetQuery.data.fat_g,
        calorie_tol_pct: targetQuery.data.calorie_tol_pct,
        protein_tol_pct: targetQuery.data.protein_tol_pct,
        carbs_tol_pct: targetQuery.data.carbs_tol_pct,
        fat_tol_pct: targetQuery.data.fat_tol_pct,
      }
    : isStandalone ? manualTarget : null
  const preferences = isStandalone ? manualPreferences : (preferencesQuery.data ?? null)
  const targetInputReadiness = !isStandalone || (
    Number.isFinite(manualTarget.calories) && manualTarget.calories > 0
    && Number.isFinite(manualTarget.protein_g) && manualTarget.protein_g >= 0
    && Number.isFinite(manualTarget.carbs_g) && manualTarget.carbs_g >= 0
    && Number.isFinite(manualTarget.fat_g) && manualTarget.fat_g >= 0
  )
    ? { ready: true, blockers: [] }
    : { ready: false, blockers: ['Enter a calorie goal above zero and non-negative protein, carbohydrate, and fat goals.'] }
  const generationOptions = preferences ? optionsFromPreferences(preferences, seed) : null
  const recipeReadiness = generationOptions && poolQuery.data
    ? getGenerationReadiness(poolQuery.data, generationOptions, GENERATOR_GUARDRAILS_APPROVED)
    : {
        ready: false,
        blockers: [poolQuery.isError
          ? 'Couldn’t load the generator-ready recipe pool. Retry before generating or publishing.'
          : 'Couldn’t load the generation preferences. Retry before generating.'],
      }
  const generationReadiness = combineReadiness(targetInputReadiness, recipeReadiness)
  const publishReadiness = plan && target && generationOptions && poolQuery.data
    ? getPublishReadiness(plan, target, generationOptions, poolQuery.data)
    : { ready: false, blockers: [] }
  const actionState = getGeneratedPlanActionState(isPreview, previewQuery.data?.generation_status)
  const publishGate = combineReadiness(generationReadiness, publishReadiness)
  const canPublish = actionState.actionable && publishGate.ready && Boolean(planName.trim())
  const published = previewQuery.data?.generation_status === 'published'

  const lockedSlots = useMemo(() => {
    const map = new Map<string, GeneratedSlot>()
    plan?.days.forEach(day => day.slots.forEach(slot => { if (slot.locked) map.set(`${day.dayOfWeek}:${slot.slot}`, slot) }))
    return map
  }, [plan])
  const planSummary = useMemo(() => {
    if (!plan?.days.length) return null
    const weeklyMeals = plan.days.reduce((sum, day) => sum + day.slots.length, 0)
    const averageCalories = plan.days.reduce((sum, day) => sum + day.totals.calories, 0) / plan.days.length
    return { days: plan.days.length, weeklyMeals, averageCalories }
  }, [plan])

  function regenerate(newSeed: number, keepLocks: boolean) {
    if (!actionState.actionable || !generationReadiness.ready || !target || !preferences || !poolQuery.data) return
    setSeed(newSeed)
    setPlan(generateWeek(poolQuery.data, target, optionsFromPreferences(preferences, newSeed), keepLocks ? lockedSlots : undefined))
  }

  function updateManualTarget(key: 'calories' | 'protein_g' | 'carbs_g' | 'fat_g', value: string) {
    setManualTarget(current => ({ ...current, [key]: numberFromInput(value) }))
    setPlan(null)
  }

  function updateManualPreferences(next: UserNutritionPreferences) {
    setManualPreferences(next)
    setPlan(null)
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

  function swapSlot(dayOfWeek: number, slotType: GeneratedSlot['slot']) {
    if (!generationReadiness.ready || !target || !preferences || !poolQuery.data || !plan) return
    const nextSeed = seed + 1000 + dayOfWeek * 7
    const result = swapGeneratedSlot(
      poolQuery.data,
      target,
      optionsFromPreferences(preferences, nextSeed),
      plan,
      dayOfWeek,
      slotType,
    )
    if (!result.ok) {
      const slotLabel = SLOT_LABELS[slotType].toLowerCase()
      notify(result.reason === 'slot-not-found'
        ? `Couldn’t swap this ${slotLabel} because the slot is no longer available. Regenerate the plan and try again.`
        : `No compatible ${slotLabel} alternative is available within the current nutrition filters and weekly repeat limit.`, 'error')
      return
    }
    setSeed(nextSeed)
    setPlan(result.plan)
  }

  const saveDraft = useMutation({
    mutationFn: async (planToSave: GeneratedPlan) => {
      if (!actionState.actionable) throw new Error('This saved plan is read-only')
      if (!targetQuery.data || !userId) throw new Error('Nothing to save yet')
      return saveGeneratedPlan({ planId: savedPlanId, userId, name: planName, description: planDescription, targetId: targetQuery.data.id, plan: planToSave })
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
      if (!plan || !canPublish) {
        throw new Error(publishGate.blockers.join(' ') || 'Nothing to publish yet')
      }
      await persistCurrentPlanThenPublish(
        plan,
        currentPlan => saveDraft.mutateAsync(currentPlan),
        planId => publishPlan(userId, planId),
      )
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

  const publishToLibrary = useMutation({
    mutationFn: async () => {
      if (!isStandalone || !plan) throw new Error('Generate a meal plan first')
      if (!planName.trim()) throw new Error('Add a plan name before publishing')
      if (!canPublish) throw new Error(publishGate.blockers.join(' ') || 'Resolve the plan checks before publishing')
      return saveGeneratedPlanToLibrary({ name: planName.trim(), description: planDescription.trim(), plan })
    },
    onSuccess: planId => {
      queryClient.invalidateQueries({ queryKey: ['meal-plans-admin'] })
      notify('Meal plan published to the library.')
      navigate(`/admin/nutrition/meal-plans/${planId}`, { replace: true })
    },
    onError: error => notify(`Couldn’t publish to the library: ${error.message}`, 'error'),
  })

  const removeDraft = useMutation({
    mutationFn: async () => {
      if (!actionState.actionable) throw new Error('This saved plan is read-only')
      if (savedPlanId) await deletePlan(savedPlanId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-plans-admin'] })
      notify('Draft deleted.')
      navigate('/admin/nutrition?tab=meal-plans')
    },
    onError: error => notify(`Couldn’t delete draft: ${error.message}`, 'error'),
  })
  const isSavingOrPublishing = saveDraft.isPending || publish.isPending || publishToLibrary.isPending

  if ((isPreview && previewQuery.isLoading) || targetQuery.isLoading || poolQuery.isLoading || preferencesQuery.isLoading || athletesQuery.isLoading) {
    return <EditorPage backTo="/admin/nutrition?tab=meal-plans" backLabel="Back to meal plans" eyebrow="Generated nutrition" title="Loading…"><Shimmer className="h-96 w-full" /></EditorPage>
  }
  if (isPreview && previewQuery.isError) {
    const message = previewQuery.error instanceof Error ? previewQuery.error.message : 'Unknown error'
    return (
      <EditorPage backTo="/admin/nutrition?tab=meal-plans" backLabel="Back to meal plans" eyebrow="Generated nutrition" title="Couldn’t load generated plan">
        <EmptyState title="Generated plan unavailable" description={`The plan request failed: ${message}. Retry or check admin access.`} />
      </EditorPage>
    )
  }
  if (targetQuery.isError) {
    const message = targetQuery.error instanceof Error ? targetQuery.error.message : 'Unknown error'
    return (
      <EditorPage backTo="/admin/nutrition?tab=meal-plans" backLabel="Back to meal plans" eyebrow="Generated nutrition" title="Couldn’t load nutrition target">
        <EmptyState title="Nutrition target unavailable" description={`The target request failed: ${message}. Retry or check admin access.`} />
      </EditorPage>
    )
  }
  if (isPreview && (!previewTargetId || previewTargetVersion == null)) {
    return (
      <EditorPage backTo="/admin/nutrition?tab=meal-plans" backLabel="Back to meal plans" eyebrow="Generated nutrition" title="Saved target unavailable">
        <EmptyState title="Saved target reference missing" description="This generated plan does not identify the nutrition target version it was built against, so it cannot be safely reviewed or published." />
      </EditorPage>
    )
  }
  if (!target) {
    const previewDescription = isPreview
      ? 'The exact nutrition target version stored on this draft no longer exists. Restore it before reviewing or publishing the plan.'
      : 'Save macro goals for the athlete first, then generate a plan.'
    return (
      <EditorPage backTo="/admin/nutrition?tab=meal-plans" backLabel="Back to meal plans" eyebrow="Generated nutrition" title="Generate meal plan">
        <EmptyState title={isPreview ? 'Saved nutrition target not found' : 'No active macro target'} description={previewDescription} />
      </EditorPage>
    )
  }

  return (
    <EditorPage
      backTo={userId ? `/admin/users/${userId}` : '/admin/nutrition?tab=meal-plans'}
      backLabel={userId ? 'Back to athlete' : 'Back to meal plans'}
      eyebrow="Generated nutrition"
      title={isPreview ? planName || 'Generated plan' : 'Generate meal plan'}
      description={isStandalone
        ? 'Build a seven-day plan from manually entered macro goals and nutrition preferences.'
        : "Deterministic draft built from the athlete's macro target and preferences. Swap or lock slots, regenerate, then publish."}
      actions={
        <>
          {savedPlanId && actionState.actionable && <Button variant="danger" onClick={() => setDeleteDialogOpen(true)} disabled={isSavingOrPublishing}>Delete draft</Button>}
          <Button variant="ghost" onClick={() => regenerate(seed + 1, true)} disabled={!actionState.actionable || !poolQuery.data?.length || isSavingOrPublishing || !generationReadiness.ready} title={actionState.actionable ? generationReadiness.blockers[0] : undefined}>
            <RefreshCw size={15} /> Regenerate
          </Button>
          {isStandalone && (
            <Button onClick={() => setLibraryPublishDialogOpen(true)} disabled={!plan || !canPublish || isSavingOrPublishing} loading={publishToLibrary.isPending} title={plan && !canPublish ? publishGate.blockers[0] : undefined}>
              Publish to library
            </Button>
          )}
          {!isStandalone && (
            <>
              <Button variant="secondary" onClick={() => { if (plan) saveDraft.mutate(plan) }} loading={saveDraft.isPending} disabled={!plan || !planName.trim() || !actionState.actionable || publish.isPending}>Save draft</Button>
              <Button onClick={() => setPublishDialogOpen(true)} disabled={!plan || !actionState.actionable || saveDraft.isPending || !canPublish} loading={publish.isPending} title={actionState.actionable && !canPublish ? publishGate.blockers[0] : undefined}>
                {published ? 'Published' : 'Publish to athlete'}
              </Button>
            </>
          )}
        </>
      }
      aside={
        <>
          <Card>
            <h2 className="text-sm font-bold text-text-primary">{isStandalone ? 'Manual macro target' : 'Athlete target'}</h2>
            <div className="mt-3 divide-y divide-outline-subtle text-sm">
              <div className="flex justify-between py-2"><span className="text-text-secondary">Calories</span><span className="font-semibold text-text-primary">{roundedTargetValue(target.calories)}</span></div>
              <div className="flex justify-between py-2"><span className="text-text-secondary">Protein</span><span className="font-semibold text-text-primary">{roundedTargetValue(target.protein_g, 'g')}</span></div>
              <div className="flex justify-between py-2"><span className="text-text-secondary">Carbs</span><span className="font-semibold text-text-primary">{roundedTargetValue(target.carbs_g, 'g')}</span></div>
              <div className="flex justify-between py-2"><span className="text-text-secondary">Fat</span><span className="font-semibold text-text-primary">{roundedTargetValue(target.fat_g, 'g')}</span></div>
            </div>
          </Card>
          {plan && (
            <Card>
              <h2 className="text-sm font-bold text-text-primary">Plan summary</h2>
              <div className="mt-3 divide-y divide-outline-subtle text-sm">
                <div className="flex justify-between py-2"><span className="text-text-secondary">Plan</span><span className="max-w-40 truncate font-semibold text-text-primary">{planName || 'Untitled'}</span></div>
                <div className="flex justify-between py-2"><span className="text-text-secondary">Schedule</span><span className="font-semibold text-text-primary">{planSummary?.days} days · {planSummary?.weeklyMeals} meals</span></div>
                <div className="flex justify-between py-2"><span className="text-text-secondary">Daily structure</span><span className="font-semibold text-text-primary">{preferences?.include_snack ? '3 meals + snack' : '3 meals'}</span></div>
                <div className="flex justify-between py-2"><span className="text-text-secondary">Average energy</span><span className="font-semibold text-text-primary">{Math.round(planSummary?.averageCalories ?? 0)} kcal/day</span></div>
              </div>
            </Card>
          )}
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
      {!actionState.actionable && actionState.title && (
        <Card className="border-outline bg-surface-secondary" role="status">
          <h2 className="text-sm font-bold text-text-primary">{actionState.title}</h2>
          <p className="mt-1 text-sm text-text-secondary">{actionState.message}</p>
        </Card>
      )}

      {actionState.actionable && generationReadiness.blockers.length > 0 && (
        <Card className="border-warning/40 bg-warning/5" role="alert">
          <h2 className="text-sm font-bold text-text-primary">Generator launch blocked</h2>
          <p className="mt-1 text-xs text-text-secondary">{isStandalone
            ? 'Generation stays disabled until every requirement below is resolved.'
            : 'Generation and publishing stay disabled until every launch requirement below is resolved.'}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-warning">
            {generationReadiness.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}
          </ul>
        </Card>
      )}

      {plan && actionState.actionable && publishReadiness.blockers.length > 0 && (
        <Card className="border-warning/40 bg-warning/5" role="alert">
          <h2 className="text-sm font-bold text-text-primary">{isStandalone ? 'Target check' : 'Publish blocked'}</h2>
          <p className="mt-1 text-xs text-text-secondary">{isStandalone
            ? 'The plan was generated, but one or more days are outside the requested targets. Adjust the inputs or regenerate.'
            : 'You can still save this draft. Complete or adjust it before publishing to the athlete.'}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-warning">
            {publishReadiness.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}
          </ul>
        </Card>
      )}

      {!isPreview && preferences && (
        <Card className="p-5">
          <h2 className="mb-1 text-sm font-bold text-text-primary">Generation inputs</h2>
          <p className="mb-4 text-xs text-text-secondary">{isStandalone
            ? 'Enter the required macro goals and filters below. Selecting an athlete is optional.'
            : "Generation uses the athlete's saved nutrition preferences. Edit them on the athlete profile before generating if they need to change."}</p>
          {isStandalone && (
            <div className="mb-6 space-y-5">
              <div>
                <label htmlFor="generator-athlete" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Athlete (optional)</label>
                <select
                  id="generator-athlete"
                  value=""
                  onChange={event => {
                    if (event.target.value) navigate(`/admin/nutrition/meal-plans/generate?user=${encodeURIComponent(event.target.value)}`, { replace: true })
                  }}
                  className="h-11 w-full rounded-xl border border-outline bg-surface px-3 text-sm text-text-primary outline-none focus:border-accent"
                >
                  <option value="">No athlete — use manual inputs</option>
                  {(athletesQuery.data ?? []).map(athlete => (
                    <option key={athlete.id} value={athlete.id}>{athlete.full_name || athlete.email}</option>
                  ))}
                </select>
                {athletesQuery.isError && <p role="alert" className="mt-2 text-sm text-error">Athletes couldn’t be loaded. Manual generation is still available.</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Input label="Calories" type="number" min="1" step="1" value={numberInputValue(manualTarget.calories)}
                  onChange={event => updateManualTarget('calories', event.target.value)} />
                <Input label="Protein (g)" type="number" min="0" step="1" value={numberInputValue(manualTarget.protein_g)}
                  onChange={event => updateManualTarget('protein_g', event.target.value)} />
                <Input label="Carbohydrates (g)" type="number" min="0" step="1" value={numberInputValue(manualTarget.carbs_g)}
                  onChange={event => updateManualTarget('carbs_g', event.target.value)} />
                <Input label="Fat (g)" type="number" min="0" step="1" value={numberInputValue(manualTarget.fat_g)}
                  onChange={event => updateManualTarget('fat_g', event.target.value)} />
              </div>
              <NutritionPreferencesForm value={manualPreferences} onChange={updateManualPreferences} locale="en" />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Plan name" value={planName} onChange={event => setPlanName(event.target.value)} disabled={isSavingOrPublishing} required />
            <Input label="Description" value={planDescription} onChange={event => setPlanDescription(event.target.value)} disabled={isSavingOrPublishing} placeholder="Optional note shown with the plan" />
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => regenerate(seed, false)} disabled={!poolQuery.data?.length || isSavingOrPublishing || !generationReadiness.ready} title={generationReadiness.blockers[0]}>Generate</Button>
          </div>
          {!poolQuery.data?.length && <p className="mt-3 text-sm text-error">No generator-ready recipes exist. Mark recipes as eligible with verified macros first.</p>}
        </Card>
      )}

      {plan && (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))]">
          {plan.days.map(day => (
            <Card key={day.dayOfWeek} className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">{DAY_SHORTS[day.dayOfWeek]}</p>
                {deltaChip(day.totals.calories, target.calories, isWithinTargetTolerances(day.totals, target))}
              </div>
              <div className="space-y-2">
                {day.slots.map(slot => (
                  <div key={slot.slot} className={`rounded-xl border p-2 ${slot.locked ? 'border-accent bg-accent/5' : 'border-outline-subtle bg-surface'}`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">{SLOT_LABELS[slot.slot]}</p>
                    <p className="mt-1 line-clamp-2 text-xs font-semibold text-text-primary">{slot.recipeName}</p>
                    <p className="mt-1 text-[11px] text-text-secondary">{slot.portionMultiplier !== 1 && `${slot.portionMultiplier}× · `}{Math.round(slot.calories)} kcal · P {Math.round(slot.protein_g)}g</p>
                    {!isPreview && !published && (
                      <div className="mt-2 flex gap-1">
                        <button type="button" aria-label={`Swap ${SLOT_LABELS[slot.slot]} on ${DAY_SHORTS[day.dayOfWeek]}`} onClick={() => swapSlot(day.dayOfWeek, slot.slot)} disabled={isSavingOrPublishing || !generationReadiness.ready} title={generationReadiness.blockers[0]} className="min-h-7 flex-1 cursor-pointer rounded-lg border border-outline bg-transparent text-[10px] font-semibold text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40">Swap</button>
                        <button type="button" aria-label={`${slot.locked ? 'Unlock' : 'Lock'} ${SLOT_LABELS[slot.slot]} on ${DAY_SHORTS[day.dayOfWeek]}`} onClick={() => toggleLock(day.dayOfWeek, slot.slot)} disabled={isSavingOrPublishing} className="flex min-h-7 w-8 cursor-pointer items-center justify-center rounded-lg border border-outline bg-transparent text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40">
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

      {plan && isStandalone && canPublish && (
        <Card className="border-accent/30 bg-accent/5">
          <h2 className="text-sm font-bold text-text-primary">Ready to publish</h2>
          <p className="mt-1 text-sm text-text-secondary">Publish this exact seven-day result to the reusable meal-plan library. It will keep the generated portion sizes and will not be assigned to an athlete until you choose one later.</p>
        </Card>
      )}

      <ConfirmDialog
        open={publishDialogOpen}
        title="Publish this plan to the athlete?"
        description="It replaces the athlete's current meal plan. The previous plan stays in assignment history."
        confirmLabel="Publish plan"
        confirmVariant="primary"
        pending={isSavingOrPublishing}
        onClose={() => setPublishDialogOpen(false)}
        onConfirm={() => { setPublishDialogOpen(false); publish.mutate() }}
      />
      <ConfirmDialog
        open={libraryPublishDialogOpen}
        title="Publish this plan to the library?"
        description={`${planName || 'This plan'} will be saved as a reusable seven-day meal plan with its exact generated portions. It will not be assigned to an athlete yet.`}
        confirmLabel="Publish to library"
        confirmVariant="primary"
        pending={publishToLibrary.isPending}
        onClose={() => setLibraryPublishDialogOpen(false)}
        onConfirm={() => { setLibraryPublishDialogOpen(false); publishToLibrary.mutate() }}
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
