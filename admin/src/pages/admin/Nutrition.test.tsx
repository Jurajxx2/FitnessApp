import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NoticeProvider } from '../../components/ui'
import { removeRecipePhoto, uploadRecipePhoto } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import type { MealPlan } from '../../types/database'
import Nutrition from './Nutrition'
import RecipeEditor from './RecipeEditor'

vi.mock('../../lib/storage', async () => {
  const actual = await vi.importActual<typeof import('../../lib/storage')>('../../lib/storage')
  return { ...actual, uploadRecipePhoto: vi.fn(), removeRecipePhoto: vi.fn() }
})
vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }))

function setupSupabase() {
  const saveRecipe = vi.fn().mockResolvedValue({ data: 'recipe-1', error: null })
  vi.mocked(uploadRecipePhoto).mockReset()
  vi.mocked(removeRecipePhoto).mockReset()
  vi.mocked(supabase.rpc).mockReset()
  vi.mocked(supabase.rpc).mockImplementation(saveRecipe)
  vi.mocked(supabase.from).mockReset()
  return { saveRecipe }
}

async function selectRecipePhoto(fileName = 'new-photo.jpg') {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => `blob:${fileName}`),
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  })
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error('Recipe photo input is missing')
  await userEvent.upload(input, new File(['photo'], fileName, { type: 'image/jpeg' }))
}

function renderRecipeEditor() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <NoticeProvider>
        <MemoryRouter initialEntries={['/admin/nutrition/recipes/new']}>
          <RecipeEditor />
        </MemoryRouter>
      </NoticeProvider>
    </QueryClientProvider>
  )
}

function mealPlan(overrides: Partial<MealPlan> = {}): MealPlan {
  return {
    id: 'plan-1',
    coach_id: 'coach-1',
    user_id: 'user-1',
    name: 'Weekly plan',
    description: null,
    valid_from: null,
    valid_to: null,
    is_active: true,
    origin: 'manual',
    created_at: '2026-07-14T00:00:00Z',
    updated_at: '2026-07-14T00:00:00Z',
    ...overrides,
  }
}

function setupMealPlansSupabase(plans: MealPlan[], options: {
  rpcResult?: { data: string | null; error: Error | null }
  manualDeleteResult?: { data: { id: string } | null; error: Error | null }
} = {}) {
  const orderPlans = vi.fn().mockResolvedValue({ data: plans, error: null })
  const selectPlans = vi.fn().mockReturnValue({ order: orderPlans })
  const selectAssignments = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
  })
  const maybeSingle = vi.fn().mockResolvedValue(
    options.manualDeleteResult ?? { data: { id: plans[0]?.id ?? 'plan-1' }, error: null },
  )
  const selectDeletedPlan = vi.fn().mockReturnValue({ maybeSingle })
  const matchDeletedPlan = vi.fn().mockReturnValue({ select: selectDeletedPlan })
  const deletePlan = vi.fn().mockReturnValue({ eq: matchDeletedPlan })
  const rpc = vi.fn().mockResolvedValue(options.rpcResult ?? { data: null, error: null })

  vi.mocked(supabase.from).mockReset()
  vi.mocked(supabase.from).mockImplementation(table => {
    if (table === 'meal_plans') return { select: selectPlans, delete: deletePlan } as never
    if (table === 'user_meal_plans') return { select: selectAssignments } as never
    throw new Error(`Unexpected table: ${table}`)
  })
  vi.mocked(supabase.rpc).mockReset()
  vi.mocked(supabase.rpc).mockImplementation(rpc)

  return { deletePlan, matchDeletedPlan, selectDeletedPlan, maybeSingle, rpc }
}

function renderNutritionMealPlans() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <NoticeProvider>
        <MemoryRouter initialEntries={['/admin/nutrition?tab=meal-plans']}>
          <Nutrition />
        </MemoryRouter>
      </NoticeProvider>
    </QueryClientProvider>,
  )
}

describe('RecipeEditor ingredient validation', () => {
  afterEach(() => cleanup())

  it('blocks saving when an ingredient row has macro data but no name', async () => {
    const { saveRecipe } = setupSupabase()
    renderRecipeEditor()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Recipe name'), 'Overnight Oats')
    const calories = screen.getByLabelText('Calories')
    await user.clear(calories)
    await user.type(calories, '120')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Row 1 has a quantity or macro value but no name. Give it a name or clear its values before saving.'
    )
    expect(screen.getByRole('button', { name: 'Add recipe' })).toBeDisabled()
    expect(saveRecipe).not.toHaveBeenCalled()
  })

  it('shows per-serving macros and sends ingredients plus generator metadata in one RPC', async () => {
    const { saveRecipe } = setupSupabase()
    renderRecipeEditor()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Recipe name'), 'Overnight Oats')
    const servings = screen.getByLabelText('Servings')
    await user.clear(servings)
    await user.type(servings, '2')
    await user.type(screen.getByLabelText('Name'), 'Oats')
    const calories = screen.getByLabelText('Calories')
    await user.clear(calories)
    await user.type(calories, '300')
    const protein = screen.getByLabelText('Protein (g)')
    await user.clear(protein)
    await user.type(protein, '10')
    await user.click(screen.getByRole('button', { name: 'Add ingredient' }))
    await user.click(screen.getByRole('checkbox', { name: /Macros verified/ }))
    await user.click(screen.getByRole('checkbox', { name: /Eligible for generator/ }))
    await user.click(screen.getByRole('button', { name: 'Breakfast' }))
    await user.click(screen.getByRole('button', { name: 'Vegetarian' }))
    await user.click(screen.getByRole('button', { name: 'Gluten' }))
    await user.type(screen.getByLabelText('Allowed portions (comma-separated ×)'), '0.5, 1.5')
    await user.type(screen.getByLabelText('Fiber per serving (g)'), '8')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Per serving')).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('5.0g')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add recipe' }))

    await waitFor(() => expect(saveRecipe).toHaveBeenCalledWith('admin_save_recipe_v2', expect.objectContaining({
      p_name: 'Overnight Oats',
      p_servings: 2,
      p_eligible_for_generator: true,
      p_macros_verified: true,
      p_is_scalable: true,
      p_allowed_portions: [0.5, 1.5],
      p_fiber_g: 8,
      p_meal_types: ['breakfast'],
      p_dietary_patterns: ['vegetarian'],
      p_allergens: ['gluten'],
    })))
    const inserted = saveRecipe.mock.calls[0][1].p_ingredients as Array<{ name: string }>
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({ name: 'Oats', calories: 300, protein_g: 10 })
    expect(saveRecipe).toHaveBeenCalledTimes(1)
    expect(supabase.from).not.toHaveBeenCalled()
    expect(await screen.findByText('Recipe added.')).toBeInTheDocument()
  })

  it('blocks fractional allowed portions for a non-scalable recipe', async () => {
    const { saveRecipe } = setupSupabase()
    renderRecipeEditor()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Recipe name'), 'Fixed portion soup')
    await user.click(screen.getByRole('checkbox', { name: /Scalable portions/ }))
    await user.type(screen.getByLabelText('Allowed portions (comma-separated ×)'), '0.5, 1')

    expect(screen.getByRole('button', { name: 'Add recipe' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Non-scalable recipes require whole allowed portions.')
    expect(saveRecipe).not.toHaveBeenCalled()
  })

  it('removes a newly uploaded unreferenced photo when the recipe RPC fails', async () => {
    const { saveRecipe } = setupSupabase()
    const rpcError = new Error('database rejected recipe')
    saveRecipe.mockResolvedValue({ data: null, error: rpcError })
    vi.mocked(uploadRecipePhoto).mockResolvedValue('https://project.supabase.co/storage/v1/object/public/recipe-photos/new-photo.jpg')
    vi.mocked(removeRecipePhoto).mockResolvedValue()
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as never)
    renderRecipeEditor()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Recipe name'), 'Photo recipe')
    await selectRecipePhoto()
    await user.click(screen.getByRole('button', { name: 'Add recipe' }))

    await waitFor(() => expect(removeRecipePhoto).toHaveBeenCalledWith('new-photo.jpg'))
    expect(await screen.findByText('Couldn’t save recipe: database rejected recipe')).toBeInTheDocument()
  })

  it('preserves a shared uploaded path when the recipe RPC fails', async () => {
    const { saveRecipe } = setupSupabase()
    const photoUrl = 'https://project.supabase.co/storage/v1/object/public/recipe-photos/shared.jpg'
    saveRecipe.mockResolvedValue({ data: null, error: new Error('database rejected recipe') })
    vi.mocked(uploadRecipePhoto).mockResolvedValue(photoUrl)
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [{ photo_url: photoUrl, photo_file_name: 'shared.jpg' }],
        error: null,
      }),
    } as never)
    renderRecipeEditor()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Recipe name'), 'Shared photo recipe')
    await selectRecipePhoto('shared.jpg')
    await user.click(screen.getByRole('button', { name: 'Add recipe' }))

    expect(await screen.findByText('Couldn’t save recipe: database rejected recipe')).toBeInTheDocument()
    expect(removeRecipePhoto).not.toHaveBeenCalled()
  })

  it('reports cleanup failure without masking the recipe RPC error', async () => {
    const { saveRecipe } = setupSupabase()
    saveRecipe.mockResolvedValue({ data: null, error: new Error('database rejected recipe') })
    vi.mocked(uploadRecipePhoto).mockResolvedValue('https://project.supabase.co/storage/v1/object/public/recipe-photos/new-photo.jpg')
    vi.mocked(removeRecipePhoto).mockRejectedValue(new Error('storage cleanup unavailable'))
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as never)
    renderRecipeEditor()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Recipe name'), 'Cleanup failure recipe')
    await selectRecipePhoto()
    await user.click(screen.getByRole('button', { name: 'Add recipe' }))

    expect(await screen.findByText(
      'Couldn’t save recipe: database rejected recipe Photo cleanup also failed: storage cleanup unavailable',
    )).toBeInTheDocument()
  })
})

describe('Nutrition meal-plan deletion', () => {
  afterEach(() => cleanup())

  it('deletes generated drafts through the admin RPC and requires the returned plan id', async () => {
    const plan = mealPlan({ id: 'generated-plan', name: 'Generated draft', origin: 'generated', generation_status: 'draft' })
    const { deletePlan, rpc } = setupMealPlansSupabase([plan], {
      rpcResult: { data: plan.id, error: null },
    })
    renderNutritionMealPlans()
    const user = userEvent.setup()

    expect(await screen.findByText(plan.name)).toBeInTheDocument()
    const row = screen.getByText(plan.name).closest('tr')!
    await user.click(within(row).getByRole('button', { name: 'Actions' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('admin_delete_generated_meal_plan', { p_plan_id: plan.id }))
    expect(deletePlan).not.toHaveBeenCalled()
    expect(await screen.findByText('Meal plan deleted.')).toBeInTheDocument()
  })

  it('exposes macro-based generation directly from the meal-plan tab', async () => {
    setupMealPlansSupabase([mealPlan()])
    renderNutritionMealPlans()

    expect(await screen.findByRole('button', { name: 'Generate from macro goals' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create meal plan' })).toBeInTheDocument()
  })

  it('does not report generated deletion success when the RPC returns no id', async () => {
    const plan = mealPlan({ id: 'generated-plan', name: 'Generated draft', origin: 'generated', generation_status: 'draft' })
    const { rpc } = setupMealPlansSupabase([plan], {
      rpcResult: { data: null, error: null },
    })
    renderNutritionMealPlans()
    const user = userEvent.setup()

    expect(await screen.findByText(plan.name)).toBeInTheDocument()
    const row = screen.getByText(plan.name).closest('tr')!
    await user.click(within(row).getByRole('button', { name: 'Actions' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(rpc).toHaveBeenCalled())
    expect(await screen.findByText('Couldn’t delete meal plan: No generated meal plan was deleted')).toBeInTheDocument()
    expect(screen.queryByText('Meal plan deleted.')).not.toBeInTheDocument()
  })

  it('uses returning maybeSingle for manual plans and rejects a zero-row delete', async () => {
    const plan = mealPlan({ id: 'manual-plan', name: 'Manual plan', origin: 'manual' })
    const { matchDeletedPlan, selectDeletedPlan, maybeSingle, rpc } = setupMealPlansSupabase([plan], {
      manualDeleteResult: { data: null, error: null },
    })
    renderNutritionMealPlans()
    const user = userEvent.setup()

    expect(await screen.findByText(plan.name)).toBeInTheDocument()
    const row = screen.getByText(plan.name).closest('tr')!
    await user.click(within(row).getByRole('button', { name: 'Actions' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(maybeSingle).toHaveBeenCalled())
    expect(matchDeletedPlan).toHaveBeenCalledWith('id', plan.id)
    expect(selectDeletedPlan).toHaveBeenCalledWith('id')
    expect(rpc).not.toHaveBeenCalled()
    expect(await screen.findByText('Couldn’t delete meal plan: No meal plan was deleted')).toBeInTheDocument()
    expect(screen.queryByText('Meal plan deleted.')).not.toBeInTheDocument()
  })

  it('bulk-deletes a selected meal plan through the shared confirm dialog', async () => {
    const plan = mealPlan({ id: 'manual-plan', name: 'Manual plan', origin: 'manual' })
    const { matchDeletedPlan, maybeSingle, rpc } = setupMealPlansSupabase([plan])
    renderNutritionMealPlans()
    const user = userEvent.setup()

    expect(await screen.findByText(plan.name)).toBeInTheDocument()
    const row = screen.getByText(plan.name).closest('tr')!
    await user.click(within(row).getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(maybeSingle).toHaveBeenCalled())
    expect(matchDeletedPlan).toHaveBeenCalledWith('id', plan.id)
    expect(rpc).not.toHaveBeenCalled()
    expect(await screen.findByText('Meal plan deleted.')).toBeInTheDocument()
  })
})
