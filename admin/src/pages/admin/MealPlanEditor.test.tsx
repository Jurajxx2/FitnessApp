import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { NoticeProvider } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import MealPlanEditor, { classifyExistingMeals, buildManagedMealDrafts } from './MealPlanEditor'

vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }))

describe('classifyExistingMeals', () => {
  it('recognizes snack as a first-class managed meal type (snack round-trip)', () => {
    const { managed } = classifyExistingMeals([
      { id: 'm1', name: 'Snack', day_of_week: 2 },
      { id: 'm2', name: 'BREAKFAST', day_of_week: 0 },
    ])
    const snack = managed.find(m => m.id === 'm1')
    expect(snack?.meal_type).toBe('snack')
    expect(snack?.dayIdx).toBe(2)
    expect(managed.find(m => m.id === 'm2')?.meal_type).toBe('breakfast')
  })

  it('preserves ids of meals the editor cannot render (unknown type or invalid day) so save never destroys them', () => {
    const { managed, unmanagedMealIds } = classifyExistingMeals([
      { id: 'm1', name: 'Snack', day_of_week: 1 },
      { id: 'm2', name: 'Brunch', day_of_week: 1 },   // unknown meal type
      { id: 'm3', name: 'Dinner', day_of_week: 99 },  // recognized type, out-of-range day
      { id: 'm4', name: 'Second Lunch', day_of_week: null },
    ])
    expect(managed.map(m => m.id)).toEqual(['m1'])
    expect(unmanagedMealIds).toEqual(['m2', 'm3', 'm4'])
  })

  it('returns nothing to preserve when every meal is managed', () => {
    const { unmanagedMealIds } = classifyExistingMeals([
      { id: 'm1', name: 'Lunch', day_of_week: 3 },
      { id: 'm2', name: 'Dinner', day_of_week: 3 },
    ])
    expect(unmanagedMealIds).toEqual([])
  })
})

// ─── buildManagedMealDrafts (the batched-load join) ────────────────────────────
//
// The old per-meal loop queried meal_plan_recipes and recipes once per meal,
// each time ordered `.eq('meal_id', item.id).order('sort_order')`, so a given
// slot's recipes always came back sorted by that meal's own sort_order.
// The batched replacement issues a single `.in('meal_id', mealIds).order
// ('sort_order')` query across every meal at once, which orders strictly by
// the sort_order column value — rows from different meals interleave when
// their sort_order sequences overlap (as they do here: both meals start at
// sort_order 0). These tests pin that buildManagedMealDrafts still produces
// the identical per-slot ordering the old loop would have, by feeding it rows
// in that interleaved shape.
describe('buildManagedMealDrafts', () => {
  it('reconstructs correct intra-slot sort_order per meal from a globally sort_order-ordered, cross-meal-interleaved row set', () => {
    const managed = [
      { id: 'meal-A', meal_type: 'breakfast' as const, dayIdx: 0 },
      { id: 'meal-B', meal_type: 'lunch' as const, dayIdx: 2 },
    ]
    const mprRows = [
      { meal_id: 'meal-A', recipe_id: 'r1', portion_multiplier: 1, sort_order: 0 },
      { meal_id: 'meal-B', recipe_id: 'r3', portion_multiplier: 1.5, sort_order: 0 },
      { meal_id: 'meal-A', recipe_id: 'r2', portion_multiplier: 2, sort_order: 1 },
      { meal_id: 'meal-B', recipe_id: 'r4', portion_multiplier: 1, sort_order: 1 },
      { meal_id: 'meal-A', recipe_id: 'ghost-recipe', portion_multiplier: 1, sort_order: 2 },
      { meal_id: 'meal-A', recipe_id: 'r5', portion_multiplier: 0.5, sort_order: 3 },
    ]
    const recipeRows = [
      { id: 'r1', name: 'Oats', calories: 300, protein_g: 10, carbs_g: 40, fat_g: 5 },
      { id: 'r2', name: 'Eggs', calories: 200, protein_g: 18, carbs_g: 2, fat_g: 14 },
      { id: 'r3', name: 'Salad', calories: 250, protein_g: 8, carbs_g: 20, fat_g: 10 },
      { id: 'r4', name: 'Chicken', calories: 400, protein_g: 35, carbs_g: 5, fat_g: 15 },
      { id: 'r5', name: 'Yogurt', calories: 150, protein_g: 12, carbs_g: 15, fat_g: 3 },
    ]

    const drafts = buildManagedMealDrafts(managed, mprRows, recipeRows)

    expect(drafts).toHaveLength(28) // 7 days x 4 meal types, same as initMeals()

    const breakfastMon = drafts.find(d => d.day_of_week === 0 && d.meal_type === 'breakfast')!
    // sort_order 0, 1, (2 = missing recipe, dropped), 3 -> r1, r2, r5
    expect(breakfastMon.recipes.map(r => r.recipe_id)).toEqual(['r1', 'r2', 'r5'])
    expect(breakfastMon.recipes.map(r => r.portion_multiplier)).toEqual([1, 2, 0.5])
    expect(breakfastMon.recipes[1]).toEqual({
      recipe_id: 'r2', recipe_name: 'Eggs', portion_multiplier: 2,
      calories: 200, protein_g: 18, carbs_g: 2, fat_g: 14,
    })

    const lunchWed = drafts.find(d => d.day_of_week === 2 && d.meal_type === 'lunch')!
    expect(lunchWed.recipes.map(r => r.recipe_id)).toEqual(['r3', 'r4'])
    expect(lunchWed.recipes.map(r => r.portion_multiplier)).toEqual([1.5, 1])

    // Every other one of the 28 slots stays untouched/empty.
    const untouched = drafts.filter(d => d !== breakfastMon && d !== lunchWed)
    expect(untouched.every(d => d.recipes.length === 0)).toBe(true)
  })

  it('falls back a zero/invalid portion_multiplier to 1, matching the old loop’s Number(...) || 1 guard', () => {
    const managed = [{ id: 'meal-A', meal_type: 'snack' as const, dayIdx: 5 }]
    const mprRows = [{ meal_id: 'meal-A', recipe_id: 'r1', portion_multiplier: 0, sort_order: 0 }]
    const recipeRows = [{ id: 'r1', name: 'Oats', calories: 300, protein_g: 10, carbs_g: 40, fat_g: 5 }]

    const drafts = buildManagedMealDrafts(managed, mprRows, recipeRows)

    expect(drafts.find(d => d.day_of_week === 5 && d.meal_type === 'snack')!.recipes[0].portion_multiplier).toBe(1)
  })

  it('produces an empty recipes list for a managed meal with zero meal_plan_recipes rows', () => {
    const managed = [{ id: 'meal-A', meal_type: 'dinner' as const, dayIdx: 1 }]
    const drafts = buildManagedMealDrafts(managed, [], [])
    expect(drafts.find(d => d.day_of_week === 1 && d.meal_type === 'dinner')!.recipes).toEqual([])
  })
})

// ─── Component-level coverage ───────────────────────────────────────────────

interface FromCall { table: string; select?: string; inArgs?: unknown[] }

function makeSupabaseMock(overrides: {
  plan?: Record<string, unknown>
  existingMeals?: Array<{ id: string; name: string; day_of_week: number | null }>
  mprRows?: Array<{ meal_id: string; recipe_id: string; portion_multiplier: number; sort_order: number }>
  recipeJoinRows?: Array<{ id: string; name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }>
  activeRecipes?: Array<{ id: string; name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }>
  assignments?: Array<{ user_id: string }>
}) {
  const fromCalls: FromCall[] = []
  const plan = overrides.plan ?? { id: 'plan-1', name: 'Week 1', description: null, origin: 'manual' }
  const existingMeals = overrides.existingMeals ?? []
  const mprRows = overrides.mprRows ?? []
  const recipeJoinRows = overrides.recipeJoinRows ?? []
  const activeRecipes = overrides.activeRecipes ?? []
  const assignments = overrides.assignments ?? []

  vi.mocked(supabase.from).mockImplementation(((table: string) => {
    const entry: FromCall = { table }
    fromCalls.push(entry)
    const builder: Record<string, unknown> = {
      select: (arg?: string) => { entry.select = arg; return builder },
      eq: () => builder,
      order: () => builder,
      in: (_col: string, ids: unknown[]) => { entry.inArgs = ids; return builder },
      single: () => Promise.resolve({ data: plan, error: null }),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        let data: unknown[] = []
        if (table === 'meals') data = existingMeals
        else if (table === 'meal_plan_recipes') data = mprRows
        else if (table === 'recipes') data = entry.select === '*' ? activeRecipes : recipeJoinRows
        else if (table === 'user_meal_plans') data = assignments
        return Promise.resolve({ data, error: null }).then(resolve, reject)
      },
    }
    return builder
  }) as never)
  return fromCalls
}

function renderEdit(planId = 'plan-1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/admin/nutrition/meal-plans/${planId}`]}>
        <NoticeProvider>
          <Routes>
            <Route path="/admin/nutrition/meal-plans/:id" element={<MealPlanEditor />} />
            <Route path="*" element={<div>Redirected</div>} />
          </Routes>
        </NoticeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function renderCreate() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/nutrition/meal-plans/new']}>
        <NoticeProvider>
          <Routes>
            <Route path="/admin/nutrition/meal-plans/new" element={<MealPlanEditor />} />
            <Route path="*" element={<div>Redirected</div>} />
          </Routes>
        </NoticeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('batched load on open (replaces the old per-meal N+1 loop)', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(() => cleanup())

  it('issues exactly one meal_plan_recipes query and one recipes-join query for a full 7-day/28-slot plan, not one per meal', async () => {
    const days = [0, 1, 2, 3, 4, 5, 6]
    const types = ['breakfast', 'lunch', 'dinner', 'snack']
    const existingMeals = days.flatMap(d => types.map(t => ({ id: `meal-${d}-${t}`, name: t, day_of_week: d })))
    // A small recipe pool reused across all 28 slots, so the union of recipe
    // ids is far smaller than the meal count — the point of the batch.
    const mprRows = existingMeals.map((meal, i) => ({
      meal_id: meal.id, recipe_id: `r${i % 3}`, portion_multiplier: 1, sort_order: 0,
    }))
    const recipeJoinRows = [
      { id: 'r0', name: 'Oats', calories: 300, protein_g: 10, carbs_g: 40, fat_g: 5 },
      { id: 'r1', name: 'Eggs', calories: 200, protein_g: 18, carbs_g: 2, fat_g: 14 },
      { id: 'r2', name: 'Salad', calories: 250, protein_g: 8, carbs_g: 20, fat_g: 10 },
    ]
    const fromCalls = makeSupabaseMock({ existingMeals, mprRows, recipeJoinRows, activeRecipes: recipeJoinRows })

    renderEdit()

    await screen.findAllByText('Oats')

    expect(fromCalls.filter(c => c.table === 'meals')).toHaveLength(1)
    expect(fromCalls.filter(c => c.table === 'meal_plan_recipes')).toHaveLength(1)
    expect(fromCalls.filter(c => c.table === 'recipes' && c.select !== '*')).toHaveLength(1)
    // The 28-slot batch query carried every managed meal id, not a subset.
    const mprCall = fromCalls.find(c => c.table === 'meal_plan_recipes')!
    expect((mprCall.inArgs as string[]).length).toBe(28)
  })

  it('preserves intra-slot recipe order end-to-end (draft state rendered from the batched, cross-meal-interleaved query result)', async () => {
    const existingMeals = [
      { id: 'meal-mon-breakfast', name: 'breakfast', day_of_week: 0 },
      { id: 'meal-wed-lunch', name: 'lunch', day_of_week: 2 },
    ]
    const mprRows = [
      { meal_id: 'meal-mon-breakfast', recipe_id: 'r1', portion_multiplier: 1, sort_order: 0 },
      { meal_id: 'meal-wed-lunch', recipe_id: 'r3', portion_multiplier: 1.5, sort_order: 0 },
      { meal_id: 'meal-mon-breakfast', recipe_id: 'r2', portion_multiplier: 2, sort_order: 1 },
    ]
    const recipeJoinRows = [
      { id: 'r1', name: 'Oats', calories: 300, protein_g: 10, carbs_g: 40, fat_g: 5 },
      { id: 'r2', name: 'Eggs', calories: 200, protein_g: 18, carbs_g: 2, fat_g: 14 },
      { id: 'r3', name: 'Salad', calories: 250, protein_g: 8, carbs_g: 20, fat_g: 10 },
    ]
    makeSupabaseMock({ existingMeals, mprRows, recipeJoinRows, activeRecipes: recipeJoinRows })

    renderEdit()

    const oats = await screen.findByText('Oats')
    const eggs = screen.getByText('Eggs')
    // Monday breakfast is the default selected day: Oats (sort_order 0) must
    // render before Eggs (sort_order 1) in the DOM.
    expect(oats.compareDocumentPosition(eggs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('never queries meal_plan_recipes or recipes when every stored meal is unmanaged (guards the empty-array .in() case)', async () => {
    const existingMeals = [{ id: 'meal-1', name: 'Brunch', day_of_week: 1 }] // unrecognized meal type
    const fromCalls = makeSupabaseMock({ existingMeals })

    renderEdit()

    await screen.findAllByText('No recipe selected.')

    expect(fromCalls.filter(c => c.table === 'meal_plan_recipes')).toHaveLength(0)
    expect(fromCalls.filter(c => c.table === 'recipes' && c.select !== '*')).toHaveLength(0)
  })

  it('queries meal_plan_recipes but skips the recipes-join query when managed meals have zero recipes (guards the empty recipe-id-union case)', async () => {
    const existingMeals = [{ id: 'meal-1', name: 'breakfast', day_of_week: 0 }]
    const fromCalls = makeSupabaseMock({ existingMeals, mprRows: [] })

    renderEdit()

    await screen.findAllByText('No recipe selected.')

    expect(fromCalls.filter(c => c.table === 'meal_plan_recipes')).toHaveLength(1)
    expect(fromCalls.filter(c => c.table === 'recipes' && c.select !== '*')).toHaveLength(0)
  })
})

describe('recipe picker (replaces the bare <select>)', () => {
  const recipePool = [
    { id: 'rec-chicken-bowl', name: 'Grilled Chicken Bowl', calories: 400, protein_g: 40, carbs_g: 30, fat_g: 10, is_active: true },
    { id: 'rec-yogurt', name: 'Greek Yogurt Parfait', calories: 220, protein_g: 18, carbs_g: 25, fat_g: 4, is_active: true },
    { id: 'rec-caesar', name: 'Chicken Caesar Salad', calories: 350, protein_g: 32, carbs_g: 12, fat_g: 18, is_active: true },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    makeSupabaseMock({ activeRecipes: recipePool })
  })
  afterEach(() => cleanup())

  it('finds recipes by a substring of the name, shows kcal/macros, excludes already-added recipes as disabled, and adds+closes on select', async () => {
    const user = userEvent.setup()
    renderCreate()

    await user.click(await screen.findByRole('button', { name: 'Add recipe to breakfast' }))
    expect(screen.getByRole('dialog', { name: 'Add recipe' })).toBeInTheDocument()

    // All three recipes visible before searching, each with macros.
    expect(screen.getByText('Grilled Chicken Bowl')).toBeInTheDocument()
    expect(screen.getByText('Greek Yogurt Parfait')).toBeInTheDocument()
    expect(screen.getByText('400 kcal · P 40g · C 30g · F 10g')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Search recipes'), 'chicken')
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)) }) // clears the 300ms debounce

    expect(await screen.findByText('Grilled Chicken Bowl')).toBeInTheDocument()
    expect(screen.getByText('Chicken Caesar Salad')).toBeInTheDocument()
    expect(screen.queryByText('Greek Yogurt Parfait')).not.toBeInTheDocument()

    await user.click(screen.getByText('Grilled Chicken Bowl'))

    // Picker closes and the recipe is now in the slot.
    expect(screen.queryByRole('dialog', { name: 'Add recipe' })).not.toBeInTheDocument()
    expect(screen.getByText('Grilled Chicken Bowl')).toBeInTheDocument()

    // Reopening the picker for the same slot shows the added recipe as disabled/"Added".
    await user.click(screen.getByRole('button', { name: 'Add recipe to breakfast' }))
    const addedRow = screen.getAllByText('Grilled Chicken Bowl').find(el => el.closest('button'))!.closest('button')!
    expect(addedRow).toBeDisabled()
    expect(screen.getByText('Added')).toBeInTheDocument()
    // The still-unadded match remains selectable.
    const casesarRow = screen.getByText('Chicken Caesar Salad').closest('button')!
    expect(casesarRow).not.toBeDisabled()
  }, 10000)
})

describe('editable portion multiplier', () => {
  const recipePool = [
    { id: 'rec-chicken-bowl', name: 'Grilled Chicken Bowl', calories: 400, protein_g: 40, carbs_g: 30, fat_g: 10, is_active: true },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    makeSupabaseMock({ activeRecipes: recipePool })
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'new-plan-id', error: null } as never)
  })
  afterEach(() => cleanup())

  it('updates the displayed kcal on blur and persists the edited multiplier through the save payload', async () => {
    const user = userEvent.setup()
    renderCreate()

    await user.click(await screen.findByRole('button', { name: 'Add recipe to breakfast' }))
    await user.click(await screen.findByText('Grilled Chicken Bowl'))

    // Default multiplier is 1x -> 400 kcal.
    expect(screen.getByText('× · 400 kcal')).toBeInTheDocument()

    const multiplierInput = screen.getByLabelText('Portion multiplier')
    fireEvent.change(multiplierInput, { target: { value: '1.5' } })
    // Typing alone must not commit — the kcal readout only updates once the
    // edit ends, so a mid-edit keystroke can never show a bogus value.
    expect(screen.getByText('× · 400 kcal')).toBeInTheDocument()

    fireEvent.blur(multiplierInput)
    expect(screen.getByText('× · 600 kcal')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Plan name'), 'Cutting week')
    await user.click(screen.getByRole('button', { name: 'Create plan' }))

    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith('admin_save_manual_meal_plan_v2', expect.objectContaining({
      p_meals: expect.arrayContaining([
        expect.objectContaining({
          day_of_week: 0,
          meal_type: 'breakfast',
          recipes: [{ recipe_id: 'rec-chicken-bowl', portion_multiplier: 1.5 }],
        }),
      ]),
    })))
  })

  it('clamps a typed value above the 0.25–3 range down to the max, on blur', async () => {
    const user = userEvent.setup()
    renderCreate()

    await user.click(await screen.findByRole('button', { name: 'Add recipe to breakfast' }))
    await user.click(await screen.findByText('Grilled Chicken Bowl'))

    const multiplierInput = screen.getByLabelText('Portion multiplier') as HTMLInputElement
    fireEvent.change(multiplierInput, { target: { value: '10' } })
    // Still showing exactly what was typed while the field has focus — no
    // rewriting under the caret.
    expect(multiplierInput.value).toBe('10')
    expect(screen.getByText('× · 400 kcal')).toBeInTheDocument()

    fireEvent.blur(multiplierInput)
    expect(multiplierInput.value).toBe('3')
    expect(screen.getByText('× · 1200 kcal')).toBeInTheDocument()
  })

  it('clamps a typed value below the 0.25–3 range up to the min, on blur', async () => {
    const user = userEvent.setup()
    renderCreate()

    await user.click(await screen.findByRole('button', { name: 'Add recipe to breakfast' }))
    await user.click(await screen.findByText('Grilled Chicken Bowl'))

    const multiplierInput = screen.getByLabelText('Portion multiplier') as HTMLInputElement
    fireEvent.change(multiplierInput, { target: { value: '0.1' } })
    fireEvent.blur(multiplierInput)

    expect(multiplierInput.value).toBe('0.25')
    expect(screen.getByText('× · 100 kcal')).toBeInTheDocument()
  })

  it('restores the last committed value on blur when the field is left empty', async () => {
    const user = userEvent.setup()
    renderCreate()

    await user.click(await screen.findByRole('button', { name: 'Add recipe to breakfast' }))
    await user.click(await screen.findByText('Grilled Chicken Bowl'))

    const multiplierInput = screen.getByLabelText('Portion multiplier') as HTMLInputElement
    // Commit a real value first (1x -> 1.5x) so there is a non-default
    // committed value to restore.
    fireEvent.change(multiplierInput, { target: { value: '1.5' } })
    fireEvent.blur(multiplierInput)
    expect(screen.getByText('× · 600 kcal')).toBeInTheDocument()

    fireEvent.change(multiplierInput, { target: { value: '' } })
    fireEvent.blur(multiplierInput)

    expect(multiplierInput.value).toBe('1.5')
    expect(screen.getByText('× · 600 kcal')).toBeInTheDocument()
  })

  it('does not snap to 0.25 mid-edit: the first keystroke "0" and a full clear-then-type of "0.5" both leave the raw text alone until blur', async () => {
    const user = userEvent.setup()
    renderCreate()

    await user.click(await screen.findByRole('button', { name: 'Add recipe to breakfast' }))
    await user.click(await screen.findByText('Grilled Chicken Bowl'))

    const multiplierInput = screen.getByLabelText('Portion multiplier') as HTMLInputElement
    expect(screen.getByText('× · 400 kcal')).toBeInTheDocument() // 1x default

    // Backspacing the field to empty (e.g. to type a replacement) must not
    // coerce Number('') === 0 into the 0.25 floor — the draft must be left
    // alone until a real number is typed.
    fireEvent.change(multiplierInput, { target: { value: '' } })
    expect(multiplierInput.value).toBe('')
    expect(screen.getByText('× · 400 kcal')).toBeInTheDocument()
    expect(screen.queryByText('× · 100 kcal')).not.toBeInTheDocument() // 0.25x snap would show this

    // The first keystroke of "0.5" must render as exactly "0", not get
    // rewritten to the 0.25 floor under the caret.
    fireEvent.change(multiplierInput, { target: { value: '0' } })
    expect(multiplierInput.value).toBe('0')
    expect(screen.getByText('× · 400 kcal')).toBeInTheDocument() // still uncommitted

    fireEvent.change(multiplierInput, { target: { value: '0.5' } })
    expect(multiplierInput.value).toBe('0.5')
    expect(screen.getByText('× · 400 kcal')).toBeInTheDocument() // still uncommitted until blur

    fireEvent.blur(multiplierInput)
    expect(multiplierInput.value).toBe('0.5')
    expect(screen.getByText('× · 200 kcal')).toBeInTheDocument()
  })

  it('never lets an out-of-range or un-blurred edit reach the save payload', async () => {
    const user = userEvent.setup()
    renderCreate()

    await user.click(await screen.findByRole('button', { name: 'Add recipe to breakfast' }))
    await user.click(await screen.findByText('Grilled Chicken Bowl'))

    const multiplierInput = screen.getByLabelText('Portion multiplier') as HTMLInputElement
    // Type an out-of-range value but never blur the field before saving.
    fireEvent.change(multiplierInput, { target: { value: '9' } })

    await user.type(screen.getByLabelText('Plan name'), 'Cutting week')
    await user.click(screen.getByRole('button', { name: 'Create plan' }))

    await waitFor(() => expect(supabase.rpc).toHaveBeenCalled())
    const payload = vi.mocked(supabase.rpc).mock.calls[0][1] as { p_meals: Array<{ recipes: Array<{ portion_multiplier: number }> }> }
    const persisted = payload.p_meals[0].recipes[0].portion_multiplier
    // The uncommitted "9" never reached the draft, so the persisted value is
    // still the last committed one (the 1x default) — and in every case it
    // must fall inside the valid range regardless.
    expect(persisted).toBe(1)
    expect(persisted).toBeGreaterThanOrEqual(0.25)
    expect(persisted).toBeLessThanOrEqual(3)
  })
})

// ─── Portion multiplier draft resync across reused rows (round-3 regression) ──
//
// PortionMultiplierInput is positioned by a key that does not include the
// day (`mealType` on the section, `${recipe_id}-${recipeIndex}` on the
// row — see the JSX around the recipe list). Switching selectedDay, or
// "Copy day to week", re-renders the *same* fiber with a different day's
// recipe row when both days have a recipe at the same slot index — the
// normal outcome of the copy feature the UI itself recommends. Without
// resyncing its local draft to the incoming `value` prop, a stale draft
// from whichever day was last edited could get committed onto the
// currently-viewed day's multiplier on the next blur, corrupting it.
describe('portion multiplier draft resync when a slot position is reused across days', () => {
  const recipePool = [
    { id: 'rec-chicken-bowl', name: 'Grilled Chicken Bowl', calories: 400, protein_g: 40, carbs_g: 30, fat_g: 10, is_active: true },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    makeSupabaseMock({ activeRecipes: recipePool })
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'new-plan-id', error: null } as never)
  })
  afterEach(() => cleanup())

  it('shows the newly-viewed day’s own committed value (not a leaked draft) and a stray blur never overwrites it', async () => {
    const user = userEvent.setup()
    renderCreate()

    // Monday: add the recipe at the 1x default.
    await user.click(await screen.findByRole('button', { name: 'Add recipe to breakfast' }))
    await user.click(await screen.findByText('Grilled Chicken Bowl'))

    // Copy Monday to the rest of the week — the exact workflow the UI
    // itself recommends — so Tuesday's breakfast slot ends up with its own
    // row at the identical recipe/index, currently also committed at 1x.
    await user.click(screen.getByRole('button', { name: 'Copy Mon to week' }))
    await user.click(await screen.findByRole('button', { name: 'Copy day' }))

    // Diverge Monday's multiplier from Tuesday's freshly-copied one.
    const mondayInput = screen.getByLabelText('Portion multiplier') as HTMLInputElement
    fireEvent.change(mondayInput, { target: { value: '3' } })
    fireEvent.blur(mondayInput)
    expect(screen.getByText('× · 1200 kcal')).toBeInTheDocument()

    // Switch to Tuesday. Both days' breakfast rows sit at the same
    // `${recipe_id}-${recipeIndex}` key, at the same `mealType` section
    // position, so React reuses the same PortionMultiplierInput fiber
    // instead of unmounting and remounting it.
    await user.click(screen.getByText('Tue').closest('button')!)

    const tuesdayInput = screen.getByLabelText('Portion multiplier') as HTMLInputElement
    // (a) The field must show Tuesday's own committed value (1x, from the
    // copy) — not a leaked "3" from Monday's just-edited draft.
    expect(tuesdayInput.value).toBe('1')
    expect(screen.getByText('× · 400 kcal')).toBeInTheDocument()

    // (b) Blurring Tuesday's field without ever editing it must not
    // silently push Monday's stale draft into Tuesday's committed value.
    fireEvent.blur(tuesdayInput)
    expect(tuesdayInput.value).toBe('1')
    expect(screen.getByText('× · 400 kcal')).toBeInTheDocument()
  })
})
