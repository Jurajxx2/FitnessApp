import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { appendUserContext, getUserContextReturn } from '../../lib/adminUserContext'
import { Button, Card, ConfirmDialog, EditorPage, FormSection, Input, Modal, SearchInput, useNotice } from '../../components/ui'
import { AssignUsersDialog } from '../../components/AssignUsersDialog'
import type { NutritionTarget, Profile, Recipe } from '../../types/database'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
const DAY_SHORTS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
type MealType = typeof MEAL_TYPES[number]
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'BREAKFAST',
  lunch: 'LUNCH',
  dinner: 'DINNER',
  snack: 'SNACK',
}

interface RecipeDraft {
  recipe_id: string
  recipe_name: string
  portion_multiplier: number
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

interface MealDraft {
  day_of_week: number
  meal_type: MealType
  recipes: RecipeDraft[]
}

function initMeals(): MealDraft[] {
  return DAYS.flatMap((_, d) =>
    MEAL_TYPES.map(t => ({ day_of_week: d, meal_type: t, recipes: [] }))
  )
}

interface ExistingMealRow {
  id: string
  name: string
  day_of_week: number | null
}

interface ManagedMeal {
  id: string
  meal_type: MealType
  dayIdx: number
}

// Splits the meals stored for a plan into the ones this editor manages (a
// recognized meal type on a valid day, which gets loaded into a draft and
// re-inserted on save) and the ids of everything else. The unmanaged ids are
// preserved on save so an edit never destroys a meal the editor can't render.
export function classifyExistingMeals(existingMeals: ExistingMealRow[]): {
  managed: ManagedMeal[]
  unmanagedMealIds: string[]
} {
  const managed: ManagedMeal[] = []
  const unmanagedMealIds: string[] = []
  for (const meal of existingMeals) {
    const mealType = meal.name.toLowerCase() as MealType
    const dayIdx = meal.day_of_week ?? 0
    const recognized = MEAL_TYPES.includes(mealType) && dayIdx >= 0 && dayIdx < DAYS.length
    if (!recognized) {
      unmanagedMealIds.push(meal.id)
      continue
    }
    managed.push({ id: meal.id, meal_type: mealType, dayIdx })
  }
  return { managed, unmanagedMealIds }
}

interface MealPlanRecipeRow {
  meal_id: string
  recipe_id: string
  portion_multiplier: number | string | null
  sort_order: number
}

interface RecipeMacroRow {
  id: string
  name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

// Joins the batched meal_plan_recipes + recipes rows into the same MealDraft[]
// shape (and intra-slot ordering) the old per-meal loop produced. `mprRows` is
// expected pre-sorted by sort_order (a single global order-by, not grouped by
// meal_id) — filtering by meal_id preserves that relative order within each
// slot regardless of how rows from different meals interleave.
export function buildManagedMealDrafts(
  managed: ManagedMeal[],
  mprRows: MealPlanRecipeRow[],
  recipeRows: RecipeMacroRow[],
): MealDraft[] {
  const drafts = initMeals()
  for (const item of managed) {
    const draft = drafts.find(d => d.day_of_week === item.dayIdx && d.meal_type === item.meal_type)
    if (!draft) continue
    const rowsForMeal = mprRows.filter(row => row.meal_id === item.id)
    draft.recipes = rowsForMeal.flatMap(row => {
      const recipe = recipeRows.find(candidate => candidate.id === row.recipe_id)
      if (!recipe) return []
      return [{
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        portion_multiplier: Number(row.portion_multiplier) || 1,
        calories: recipe.calories,
        protein_g: recipe.protein_g,
        carbs_g: recipe.carbs_g,
        fat_g: recipe.fat_g,
      }]
    })
  }
  return drafts
}

function useRecipes() {
  return useQuery<Recipe[]>({
    queryKey: ['recipes-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('recipes').select('*').eq('is_active', true).order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

function useProfiles() {
  return useQuery<Pick<Profile, 'id' | 'email' | 'full_name' | 'is_admin' | 'is_blocked'>[]>({
    queryKey: ['profiles-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, is_admin, is_blocked')
        .order('full_name')
      if (error) throw error
      return data ?? []
    },
  })
}

// ─── Recipe picker ────────────────────────────────────────────────────────────

interface RecipePickerModalProps {
  open: boolean
  recipes: Recipe[]
  excludedIds: string[]
  onClose: () => void
  onSelect: (recipe: Recipe) => void
}

// Client-side search only — fine at the current recipe-library size (26
// active recipes). Debounced 300ms to match the existing pattern in
// components/ExercisePicker.tsx rather than re-filtering on every keystroke.
function RecipePickerModal({ open, recipes, excludedIds, onClose, onSelect }: RecipePickerModalProps) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    if (!open) {
      setSearch('')
      setDebouncedSearch('')
    }
  }, [open])

  const excluded = new Set(excludedIds)
  const filtered = recipes.filter(recipe => recipe.name.toLowerCase().includes(debouncedSearch))

  return (
    <Modal open={open} onClose={onClose} title="Add recipe">
      <SearchInput
        value={search}
        onChange={event => setSearch(event.target.value)}
        onClear={() => setSearch('')}
        placeholder="Search recipes…"
        aria-label="Search recipes"
        autoFocus
      />
      <div className="mt-4 flex max-h-96 flex-col gap-2 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-outline p-5 text-center text-sm text-text-secondary">No recipes match this search.</p>
        ) : filtered.map(recipe => {
          const isAdded = excluded.has(recipe.id)
          return (
            <button
              key={recipe.id}
              type="button"
              disabled={isAdded}
              onClick={() => { onSelect(recipe); onClose() }}
              className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors disabled:cursor-default ${isAdded ? 'border-outline-subtle bg-surface-highest opacity-70' : 'cursor-pointer border-outline-subtle bg-surface hover:border-accent'}`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-text-primary">{recipe.name}</span>
                <span className="block text-xs text-text-secondary">{Math.round(recipe.calories)} kcal · P {recipe.protein_g}g · C {recipe.carbs_g}g · F {recipe.fat_g}g</span>
              </span>
              <span className={`flex-shrink-0 text-xs font-semibold ${isAdded ? 'text-success' : 'text-accent'}`}>{isAdded ? 'Added' : 'Add'}</span>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

export default function MealPlanEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialUserId = searchParams.get('user')
  const qc = useQueryClient()
  const { notify } = useNotice()
  const isNew = !id

  const { data: recipes = [] } = useRecipes()
  const { data: profiles = [] } = useProfiles()
  const { data: target } = useQuery<NutritionTarget | null>({
    queryKey: ['admin-nutrition-target', initialUserId],
    enabled: isNew && Boolean(initialUserId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_active_nutrition_target', { p_user_id: initialUserId! })
      if (error) throw error
      return (data as NutritionTarget[] | null)?.[0] ?? null
    },
  })

  const [planName, setPlanName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedDay, setSelectedDay] = useState(0)
  const [meals, setMeals] = useState<MealDraft[]>(initMeals)
  // Ids of stored meals this editor loaded but does not manage (unrecognized
  // type/day). Kept out of the save-time delete so they are never destroyed.
  const [unmanagedMealIds, setUnmanagedMealIds] = useState<string[]>([])
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([])
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [pickerTarget, setPickerTarget] = useState<{ dayOfWeek: number; mealType: MealType } | null>(null)

  useEffect(() => {
    if (isNew && initialUserId) setAssignedUserIds([initialUserId])
  }, [initialUserId, isNew])

  useEffect(() => {
    if (isNew) return
    async function load() {
      const { data: plan } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('id', id!)
        .single()
      if (!plan) return
      if (plan.origin && plan.origin !== 'manual') {
        navigate(`/admin/nutrition/meal-plans/${id}/preview`, { replace: true })
        return
      }

      setPlanName(plan.name)
      setDescription(plan.description ?? '')

      const { data: existingMeals } = await supabase
        .from('meals')
        .select('id, name, day_of_week')
        .eq('meal_plan_id', id!)

      if (existingMeals?.length) {
        const { managed, unmanagedMealIds: preserved } = classifyExistingMeals(existingMeals)
        // Remember unmanaged rows so savePlan can leave them untouched.
        setUnmanagedMealIds(preserved)

        // Batched replacement for the old per-meal loop: one meal_plan_recipes
        // query for every managed meal id, one recipes query for the union of
        // recipe ids referenced by those rows, then join in JS. Guard both
        // queries behind a non-empty id check — Supabase's .in() with an empty
        // array is a query worth skipping, not issuing.
        const mealIds = managed.map(item => item.id)
        let mprRows: MealPlanRecipeRow[] = []
        if (mealIds.length) {
          const { data } = await supabase
            .from('meal_plan_recipes')
            .select('meal_id, recipe_id, portion_multiplier, sort_order')
            .in('meal_id', mealIds)
            .order('sort_order')
          mprRows = data ?? []
        }

        const allRecipeIds = [...new Set(mprRows.map(row => row.recipe_id))]
        let recipeRows: RecipeMacroRow[] = []
        if (allRecipeIds.length) {
          const { data } = await supabase
            .from('recipes')
            .select('id, name, calories, protein_g, carbs_g, fat_g')
            .in('id', allRecipeIds)
          recipeRows = data ?? []
        }

        setMeals(buildManagedMealDrafts(managed, mprRows, recipeRows))
      }

      const { data: assignments } = await supabase
        .from('user_meal_plans')
        .select('user_id')
        .eq('meal_plan_id', id!)
        .eq('status', 'current')
      setAssignedUserIds((assignments ?? []).map(a => a.user_id))
    }
    load()
  }, [id, isNew])

  function addRecipe(dayOfWeek: number, mealType: MealType, recipeId: string) {
    const recipe = recipes.find(r => r.id === recipeId)
    if (!recipe) return
    setMeals(prev => prev.map(m =>
      m.day_of_week === dayOfWeek && m.meal_type === mealType
        ? {
            ...m,
            recipes: [...m.recipes, {
              recipe_id: recipe.id,
              recipe_name: recipe.name,
              portion_multiplier: 1,
              calories: recipe.calories,
              protein_g: recipe.protein_g,
              carbs_g: recipe.carbs_g,
              fat_g: recipe.fat_g,
            }],
          }
        : m
    ))
  }

  function removeRecipe(dayOfWeek: number, mealType: MealType, recipeIndex: number) {
    setMeals(prev => prev.map(m =>
      m.day_of_week === dayOfWeek && m.meal_type === mealType
        ? { ...m, recipes: m.recipes.filter((_, i) => i !== recipeIndex) }
        : m
    ))
  }

  function updatePortionMultiplier(dayOfWeek: number, mealType: MealType, recipeIndex: number, rawValue: string) {
    const parsed = Number(rawValue)
    if (!Number.isFinite(parsed)) return
    const clamped = Math.min(3, Math.max(0.25, parsed))
    setMeals(prev => prev.map(m =>
      m.day_of_week === dayOfWeek && m.meal_type === mealType
        ? { ...m, recipes: m.recipes.map((recipe, i) => i === recipeIndex ? { ...recipe, portion_multiplier: clamped } : recipe) }
        : m
    ))
  }

  function copySelectedDayToWeek() {
    const sourceMeals = MEAL_TYPES.map(type => getDraft(selectedDay, type))
    setMeals(previous => previous.map(meal => {
      const source = sourceMeals.find(item => item.meal_type === meal.meal_type)
      if (!source || meal.day_of_week === selectedDay) return meal
      return { ...meal, recipes: source.recipes.map(recipe => ({ ...recipe })) }
    }))
    setCopyDialogOpen(false)
    notify(`${DAYS[selectedDay]} copied to the rest of the week.`)
  }

  const savePlan = useMutation({
    mutationFn: async () => {
      const nonEmpty = meals.filter(m => m.recipes.length > 0)
      const { data: savedPlanId, error } = await supabase.rpc('admin_save_manual_meal_plan_v2', {
        p_plan_id: id ?? null,
        p_name: planName,
        p_description: description,
        p_meals: nonEmpty.map(meal => ({
          day_of_week: meal.day_of_week,
          meal_type: meal.meal_type,
          recipes: meal.recipes.map(recipe => ({
            recipe_id: recipe.recipe_id,
            portion_multiplier: recipe.portion_multiplier,
          })),
        })),
        p_preserved_meal_ids: unmanagedMealIds,
        p_assigned_user_ids: assignedUserIds,
      })
      if (error) throw error
      return savedPlanId as string
    },
    onSuccess: savedPlanId => {
      qc.invalidateQueries({ queryKey: ['meal-plans-admin'] })
      qc.invalidateQueries({ queryKey: ['meal-plan-assignment-counts'] })
      notify(isNew ? 'Meal plan created.' : 'Meal plan saved.')
      if (initialUserId) {
        if (isNew) navigate(appendUserContext(`/admin/nutrition/meal-plans/${savedPlanId}`, initialUserId), { replace: true })
      } else {
        navigate('/admin/nutrition?tab=meal-plans')
      }
    },
    onError: error => notify(`Couldn’t save meal plan: ${error.message}`, 'error'),
  })

  function getDraft(d: number, t: MealType): MealDraft {
    return meals.find(m => m.day_of_week === d && m.meal_type === t)!
  }

  const selectedDayRecipeCount = MEAL_TYPES.reduce((sum, type) => sum + getDraft(selectedDay, type).recipes.length, 0)
  const weeklyRecipeCount = meals.reduce((sum, meal) => sum + meal.recipes.length, 0)
  const selectedDayMacros = MEAL_TYPES
    .flatMap(type => getDraft(selectedDay, type).recipes)
    .reduce((total, recipe) => ({
      calories: total.calories + recipe.calories * recipe.portion_multiplier,
      proteinG: total.proteinG + recipe.protein_g * recipe.portion_multiplier,
      carbsG: total.carbsG + recipe.carbs_g * recipe.portion_multiplier,
      fatG: total.fatG + recipe.fat_g * recipe.portion_multiplier,
    }), { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 })
  const targetAthlete = profiles.find(profile => profile.id === initialUserId)
  const { to: returnTo, label: returnLabel } = getUserContextReturn(
    initialUserId,
    targetAthlete,
    '/admin/nutrition?tab=meal-plans',
    'Back to meal plans',
  )

  return (
    <EditorPage
      backTo={returnTo}
      backLabel={returnLabel}
      eyebrow="Weekly nutrition"
      title={isNew ? 'Create meal plan' : planName || 'Edit meal plan'}
      description="Build a reusable seven-day schedule from active recipes, then assign the finished plan to athletes."
      actions={
        <>
          <Button variant="ghost" onClick={() => navigate(returnTo)}>Cancel</Button>
          {isNew && (
            <Button
              variant="secondary"
              onClick={() => navigate(`/admin/nutrition/meal-plans/generate${initialUserId ? `?user=${encodeURIComponent(initialUserId)}` : ''}`)}
            >
              Generate from macro goals
            </Button>
          )}
          <Button onClick={() => savePlan.mutate()} disabled={!planName.trim()} loading={savePlan.isPending}>{isNew ? 'Create plan' : 'Save changes'}</Button>
        </>
      }
      aside={
        <>
          <Card>
            <h2 className="text-sm font-bold text-text-primary">Plan summary</h2>
            <div className="mt-3 divide-y divide-outline-subtle text-sm">
              <div className="flex justify-between gap-3 py-2"><span className="text-text-secondary">Weekly recipes</span><span className="font-semibold text-text-primary">{weeklyRecipeCount}</span></div>
              <div className="flex justify-between gap-3 py-2"><span className="text-text-secondary">Selected day</span><span className="font-semibold text-text-primary">{selectedDayRecipeCount}</span></div>
              <div className="flex justify-between gap-3 py-2"><span className="text-text-secondary">Assignments</span><span className="font-semibold text-text-primary">{assignedUserIds.length}</span></div>
            </div>
          </Card>
          {isNew && initialUserId && (
            <Card>
              <h2 className="text-sm font-bold text-text-primary">Target-aware plan</h2>
              <p className="mt-2 text-xs text-text-secondary">Preassigned to {targetAthlete?.full_name ?? targetAthlete?.email ?? 'the selected athlete'}.</p>
              {target ? (
                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between gap-3"><span className="text-text-secondary">Calories</span><span className="font-semibold text-text-primary">{Math.round(selectedDayMacros.calories)} / {Math.round(target.calories)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-text-secondary">Protein</span><span className="font-semibold text-text-primary">{Math.round(selectedDayMacros.proteinG)}g / {Math.round(target.protein_g)}g</span></div>
                  <div className="flex justify-between gap-3"><span className="text-text-secondary">Carbs</span><span className="font-semibold text-text-primary">{Math.round(selectedDayMacros.carbsG)}g / {Math.round(target.carbs_g)}g</span></div>
                  <div className="flex justify-between gap-3"><span className="text-text-secondary">Fat</span><span className="font-semibold text-text-primary">{Math.round(selectedDayMacros.fatG)}g / {Math.round(target.fat_g)}g</span></div>
                  <p className="border-t border-outline-subtle pt-2 text-text-secondary">Values compare the selected day with the athlete’s active coach target.</p>
                </div>
              ) : <p className="mt-3 text-xs text-error">No active macro target was found.</p>}
            </Card>
          )}
          <Card>
            <h2 className="text-sm font-bold text-text-primary">User assignments</h2>
            <p className="mt-2 text-xs leading-5 text-text-secondary">Assignments are applied atomically when the plan is saved. Replaced plans remain in assignment history.</p>
            <Button variant="ghost" className="mt-4 w-full" onClick={() => setAssignDialogOpen(true)}>Manage assignments</Button>
          </Card>
        </>
      }
    >
      <FormSection title="Plan details" description="Use a name coaches can recognize quickly and a short athlete-facing description.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Plan name" value={planName} onChange={event => setPlanName(event.target.value)} placeholder="Balanced performance week" required autoFocus={isNew} />
          <Input label="Description" value={description} onChange={event => setDescription(event.target.value)} placeholder="Optional description" />
        </div>
      </FormSection>

      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-subtle p-5">
          <div>
            <h2 className="font-bold text-text-primary">Weekly schedule</h2>
            <p className="mt-1 text-xs text-text-secondary">Build one day, copy it to the week, then fine-tune exceptions.</p>
          </div>
          <Button variant="ghost" onClick={() => setCopyDialogOpen(true)} disabled={selectedDayRecipeCount === 0}>Copy {DAY_SHORTS[selectedDay]} to week</Button>
        </div>

        <div className="flex overflow-x-auto border-b border-outline-subtle px-3 pt-2">
          {DAY_SHORTS.map((day, index) => {
            const count = MEAL_TYPES.reduce((sum, type) => sum + getDraft(index, type).recipes.length, 0)
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(index)}
                className={`min-h-11 cursor-pointer whitespace-nowrap border-x-0 border-t-0 border-b-2 bg-transparent px-4 text-sm font-semibold transition-colors ${selectedDay === index ? 'border-accent text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
              >
                {day}{count > 0 && <span className="ml-1.5 rounded-full bg-surface-highest px-1.5 py-0.5 text-[10px]">{count}</span>}
              </button>
            )
          })}
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {MEAL_TYPES.map(mealType => {
            const draft = getDraft(selectedDay, mealType)
            return (
              <section key={mealType} className="rounded-2xl border border-outline-subtle bg-surface p-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-text-secondary">{MEAL_LABELS[mealType]}</p>
                {draft.recipes.length > 0 ? (
                  <div className="mb-3 space-y-2">
                    {draft.recipes.map((recipe, recipeIndex) => (
                      <div key={`${recipe.recipe_id}-${recipeIndex}`} className="flex items-center justify-between gap-2 rounded-xl border border-outline-subtle bg-surface-elevated px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium text-text-primary">{recipe.recipe_name}</span>
                          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-text-secondary">
                            <input
                              type="number"
                              aria-label="Portion multiplier"
                              min={0.25}
                              max={3}
                              step={0.25}
                              value={recipe.portion_multiplier}
                              onChange={event => updatePortionMultiplier(selectedDay, mealType, recipeIndex, event.target.value)}
                              className="min-h-11 w-14 rounded-lg border border-outline bg-surface px-1.5 text-center text-xs text-text-primary outline-none focus:border-accent"
                            />
                            <span>× · {Math.round(recipe.calories * recipe.portion_multiplier)} kcal</span>
                          </div>
                        </div>
                        <button type="button" aria-label={`Remove ${recipe.recipe_name}`} onClick={() => removeRecipe(selectedDay, mealType, recipeIndex)} className="min-h-8 cursor-pointer rounded-lg border-0 bg-transparent px-1 text-xs text-error hover:bg-error/10">Remove</button>
                      </div>
                    ))}
                  </div>
                ) : <p className="mb-3 text-xs text-text-secondary">No recipe selected.</p>}
                <Button
                  variant="ghost"
                  className="w-full justify-center"
                  aria-label={`Add recipe to ${MEAL_LABELS[mealType].toLowerCase()}`}
                  onClick={() => setPickerTarget({ dayOfWeek: selectedDay, mealType })}
                >
                  + Add recipe
                </Button>
              </section>
            )
          })}
        </div>
      </Card>

      {savePlan.isError && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">Save failed: {(savePlan.error as Error).message}</p>}

      <AssignUsersDialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} profiles={profiles} value={assignedUserIds} onChange={setAssignedUserIds} />
      <ConfirmDialog open={copyDialogOpen} title={`Copy ${DAYS[selectedDay]} to the week?`} description="This replaces the recipe selections for the other six days. You can fine-tune individual days right after copying." confirmLabel="Copy day" onClose={() => setCopyDialogOpen(false)} onConfirm={copySelectedDayToWeek} />
      <RecipePickerModal
        open={pickerTarget !== null}
        recipes={recipes}
        excludedIds={pickerTarget ? getDraft(pickerTarget.dayOfWeek, pickerTarget.mealType).recipes.map(r => r.recipe_id) : []}
        onClose={() => setPickerTarget(null)}
        onSelect={recipe => { if (pickerTarget) addRecipe(pickerTarget.dayOfWeek, pickerTarget.mealType, recipe.id) }}
      />
    </EditorPage>
  )
}
