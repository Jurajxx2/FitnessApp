import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { NoticeProvider } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import {
  fetchGeneratedPlan,
  fetchGeneratorPool,
  fetchNutritionTargetVersion,
  saveGeneratedPlan,
  saveGeneratedPlanToLibrary,
} from '../../nutrition/generationApi'
import type { GeneratedPlanRecord } from '../../nutrition/generationApi'
import { generateWeek, type GeneratorOptions, type GeneratorRecipe, type SlotType } from '../../nutrition/generator'
import type { NutritionTarget } from '../../types/database'
import GeneratePlan from './GeneratePlan'

vi.mock('../../nutrition/generationApi', () => ({
  deletePlan: vi.fn(),
  fetchGeneratedPlan: vi.fn(),
  fetchGeneratorPool: vi.fn(),
  fetchNutritionTargetVersion: vi.fn(),
  persistCurrentPlanThenPublish: vi.fn(),
  publishPlan: vi.fn(),
  saveGeneratedPlan: vi.fn(),
  saveGeneratedPlanToLibrary: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }))

vi.mock('../../nutrition/preferences', () => ({
  useNutritionPreferences: () => ({
    data: {
      user_id: 'athlete-1',
      dietary_patterns: [],
      excluded_allergens: [],
      disliked_recipe_ids: [],
      favourite_recipe_ids: [],
      meals_per_day: 3,
      include_snack: false,
      meal_distribution: null,
      max_prep_time_min: null,
      max_recipe_repeats_per_week: 2,
      updated_at: '2026-07-14T00:00:00Z',
    },
    isLoading: false,
    isError: false,
  }),
}))

const target = {
  id: 'target-1',
  user_id: 'athlete-1',
  source: 'admin',
  created_by: 'coach-1',
  calories: 600,
  protein_g: 45,
  carbs_g: 60,
  fat_g: 18,
  fiber_g_min: null,
  calorie_tol_pct: 5,
  protein_tol_pct: 10,
  carbs_tol_pct: 15,
  fat_tol_pct: 15,
  version: 1,
  is_locked: true,
  effective_from: '2026-07-14T00:00:00Z',
  effective_to: null,
  created_at: '2026-07-14T00:00:00Z',
} satisfies NutritionTarget

function generatedPlan(generationStatus: string): GeneratedPlanRecord {
  return {
    id: 'plan-1',
    user_id: 'athlete-1',
    name: 'Saved generated plan',
    description: null,
    generation_status: generationStatus,
    nutrition_target_id: 'target-1',
    target_version: 1,
    score: 0,
    diagnostics: { poolSizePerSlot: {}, daysOutOfTolerance: [], notes: [] },
    days: [{
      dayOfWeek: 0,
      slots: [{
        slot: 'breakfast',
        recipeId: 'recipe-1',
        recipeName: 'Breakfast',
        portionMultiplier: 1,
        calories: 600,
        protein_g: 45,
        carbs_g: 60,
        fat_g: 18,
        fiber_g: null,
        locked: false,
      }],
      totals: { calories: 600, protein_g: 45, carbs_g: 60, fat_g: 18 },
      withinTolerance: true,
    }],
  }
}

function renderPreview() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/nutrition/generated/plan-1']}>
        <NoticeProvider>
          <Routes>
            <Route path="/admin/nutrition/generated/:id" element={<GeneratePlan />} />
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
      <MemoryRouter initialEntries={['/admin/nutrition/generate?user=athlete-1']}>
        <NoticeProvider>
          <Routes>
            <Route path="/admin/nutrition/generate" element={<GeneratePlan />} />
          </Routes>
        </NoticeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function renderChooseAthlete() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/nutrition/generate']}>
        <NoticeProvider>
          <Routes>
            <Route path="/admin/nutrition/generate" element={<GeneratePlan />} />
            <Route path="/admin/nutrition/meal-plans/:id" element={<div>Saved library plan</div>} />
          </Routes>
        </NoticeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function mockAthletes(athletes: Array<{ id: string; email: string; full_name: string }>) {
  const order = vi.fn().mockResolvedValue({ data: athletes, error: null })
  const secondEq = vi.fn().mockReturnValue({ order })
  const firstEq = vi.fn().mockReturnValue({ eq: secondEq })
  const select = vi.fn().mockReturnValue({ eq: firstEq })
  vi.mocked(supabase.from).mockReturnValue({ select } as never)
  return { select }
}

function generatorRecipes(): GeneratorRecipe[] {
  const slots: SlotType[] = ['breakfast', 'lunch', 'dinner']
  return slots.flatMap((slot, slotIndex) => Array.from({ length: 4 }, (_, index) => ({
    id: `${slot}-${index + 1}`,
    name: `${slot} ${index + 1}`,
    calories: [600, 800, 600][slotIndex],
    protein_g: [45, 60, 45][slotIndex],
    carbs_g: [66, 88, 66][slotIndex],
    fat_g: [20, 25, 20][slotIndex],
    fiber_g: 8,
    prep_time_min: 10,
    cook_time_min: 10,
    meal_types: [slot],
    dietary_patterns: [],
    allergens: [],
    is_active: true,
    eligible_for_generator: true,
    macros_verified: true,
    is_scalable: true,
    allowed_portions: null,
  })))
}

const generatorOptions: GeneratorOptions = {
  includeSnack: false,
  mealDistribution: null,
  dietaryPatterns: [],
  excludedAllergens: [],
  maxPrepTimeMin: null,
  maxRecipeRepeatsPerWeek: 2,
  dislikedRecipeIds: [],
  favouriteRecipeIds: [],
  seed: 1,
}

beforeEach(() => {
  vi.mocked(fetchGeneratorPool).mockResolvedValue([])
  vi.mocked(fetchNutritionTargetVersion).mockResolvedValue(target)
  vi.mocked(saveGeneratedPlan).mockResolvedValue('plan-1')
  vi.mocked(saveGeneratedPlanToLibrary).mockResolvedValue('library-plan-1')
  vi.mocked(supabase.rpc).mockResolvedValue({ data: [target], error: null } as never)
  vi.mocked(supabase.from).mockReset()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('generated plan preview actions', () => {
  it.each([
    ['published', 'Published plan'],
    ['superseded', 'Superseded plan'],
    ['failed', 'Failed generation'],
  ])('renders %s previews as an explicit read-only state', async (status, title) => {
    vi.mocked(fetchGeneratedPlan).mockResolvedValue(generatedPlan(status))

    renderPreview()

    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete draft' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled()
    expect(screen.getByRole('button', { name: status === 'published' ? 'Published' : 'Publish to athlete' })).toBeDisabled()
  })

  it('keeps only a draft preview actionable', async () => {
    vi.mocked(fetchGeneratedPlan).mockResolvedValue(generatedPlan('draft'))

    renderPreview()

    expect(await screen.findByRole('button', { name: 'Delete draft' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled()
    expect(screen.queryByText('Read-only plan')).not.toBeInTheDocument()
  })
})

describe('day tolerance chip', () => {
  it('flags a day that meets calories but misses carbs as outside tolerance', async () => {
    const plan = generatedPlan('draft')
    // Calories on target (600), but carbs 100 vs 60 ±15% → the day is out of tolerance overall.
    plan.days[0].totals = { calories: 600, protein_g: 45, carbs_g: 100, fat_g: 18 }
    plan.days[0].withinTolerance = true // optimistic/stale persisted flag must not fool the chip
    vi.mocked(fetchGeneratedPlan).mockResolvedValue(plan)

    renderPreview()

    expect(await screen.findByTitle(/outside target tolerances/i)).toBeInTheDocument()
    expect(screen.getByText('Outside: Carbs +67% (allowed ±15%)')).toBeInTheDocument()
  })

  it('marks a fully in-tolerance day as within target', async () => {
    vi.mocked(fetchGeneratedPlan).mockResolvedValue(generatedPlan('draft'))

    renderPreview()

    expect(await screen.findByTitle(/within all target tolerances/i)).toBeInTheDocument()
  })
})

describe('generation preferences', () => {
  it('uses persisted athlete preferences without exposing run-only overrides', async () => {
    renderCreate()

    expect(await screen.findByText("Generation uses the athlete's saved nutrition preferences. Edit them on the athlete profile before generating if they need to change.")).toBeInTheDocument()
    expect(screen.queryByText('Dietary patterns')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Include snack')).not.toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toHaveLength(2)
    expect(screen.getByRole('textbox', { name: 'Plan name' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Description' })).toBeInTheDocument()
    expect(supabase.rpc).toHaveBeenCalledWith('get_active_nutrition_target', { p_user_id: 'athlete-1' })
  })

  it('keeps athlete selection optional when opening generation from the nutrition tab', async () => {
    const { select } = mockAthletes([{ id: 'athlete-1', email: 'athlete@example.com', full_name: 'Athlete One' }])

    renderChooseAthlete()

    expect(await screen.findByRole('heading', { name: 'Generation inputs' })).toBeInTheDocument()
    expect(screen.getByLabelText('Athlete (optional)')).toHaveTextContent('No athlete — use manual inputs')
    expect(screen.getByLabelText('Athlete (optional)')).toHaveTextContent('Athlete One')
    expect(screen.getByLabelText('Calories')).toHaveValue(2000)
    expect(screen.getByLabelText('Protein (g)')).toHaveValue(150)
    expect(screen.getByLabelText('Carbohydrates (g)')).toHaveValue(220)
    expect(screen.getByLabelText('Fat (g)')).toHaveValue(65)
    expect(select).toHaveBeenCalledWith('id, email, full_name')
  })

  it('generates a complete plan from manual inputs without loading an athlete target', async () => {
    const user = userEvent.setup()
    mockAthletes([])
    vi.mocked(fetchGeneratorPool).mockResolvedValue(generatorRecipes())

    renderChooseAthlete()

    const generate = await screen.findByRole('button', { name: 'Generate' })
    expect(generate).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publish to athlete' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish to library' })).toBeDisabled()

    await user.click(generate)

    expect(await screen.findByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Sun')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Plan summary' })).toBeInTheDocument()
    expect(screen.getByText('Ready to publish')).toBeInTheDocument()
    const publishToLibrary = screen.getByRole('button', { name: 'Publish to library' })
    expect(publishToLibrary).toBeEnabled()
    expect(supabase.rpc).not.toHaveBeenCalledWith('get_active_nutrition_target', expect.anything())

    await user.click(publishToLibrary)
    expect(screen.getByRole('heading', { name: 'Publish this plan to the library?' })).toBeInTheDocument()
    const publishButtons = screen.getAllByRole('button', { name: 'Publish to library' })
    await user.click(publishButtons[publishButtons.length - 1])

    expect(saveGeneratedPlanToLibrary).toHaveBeenCalledWith(expect.objectContaining({
      name: expect.stringContaining('Generated plan'),
      description: '',
    }))

  })

  it('clears the generated preview when manual macro inputs become invalid', async () => {
    const user = userEvent.setup()
    mockAthletes([])
    vi.mocked(fetchGeneratorPool).mockResolvedValue(generatorRecipes())

    renderChooseAthlete()

    const generate = await screen.findByRole('button', { name: 'Generate' })
    await user.click(generate)
    expect(await screen.findByText('Mon')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Calories'))

    expect(screen.getByLabelText('Calories')).toHaveValue(null)
    expect(generate).toBeDisabled()
    expect(screen.queryByText('Mon')).not.toBeInTheDocument()
  })

  it('replaces the selected recipe when a compatible alternative has weekly capacity', async () => {
    const user = userEvent.setup()
    const pool = generatorRecipes()
    const initialPlan = generateWeek(pool, target, generatorOptions)
    const breakfastUsage = new Map<string, number>()
    initialPlan.days.forEach(day => {
      const breakfast = day.slots.find(slot => slot.slot === 'breakfast')!
      breakfastUsage.set(breakfast.recipeId, (breakfastUsage.get(breakfast.recipeId) ?? 0) + 1)
    })
    const swappableDay = initialPlan.days.find(day => {
      const breakfast = day.slots.find(slot => slot.slot === 'breakfast')!
      return breakfastUsage.get(breakfast.recipeId) === 2
    })!
    const originalRecipe = swappableDay.slots.find(slot => slot.slot === 'breakfast')!
    mockAthletes([])
    vi.mocked(fetchGeneratorPool).mockResolvedValue(pool)

    renderChooseAthlete()
    await user.click(await screen.findByRole('button', { name: 'Generate' }))
    expect(screen.getAllByText(originalRecipe.recipeName)).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: `Swap Breakfast on ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][swappableDay.dayOfWeek]}` }))

    await waitFor(() => expect(screen.getAllByText(originalRecipe.recipeName)).toHaveLength(1))
  })

  it('keeps the plan unchanged and shows an error when no compatible alternative has weekly capacity', async () => {
    const user = userEvent.setup()
    const pool = generatorRecipes()
    const initialPlan = generateWeek(pool, target, generatorOptions)
    const breakfastUsage = new Map<string, number>()
    initialPlan.days.forEach(day => {
      const breakfast = day.slots.find(slot => slot.slot === 'breakfast')!
      breakfastUsage.set(breakfast.recipeId, (breakfastUsage.get(breakfast.recipeId) ?? 0) + 1)
    })
    const blockedDay = initialPlan.days.find(day => {
      const breakfast = day.slots.find(slot => slot.slot === 'breakfast')!
      return breakfastUsage.get(breakfast.recipeId) === 1
    })!
    const originalRecipe = blockedDay.slots.find(slot => slot.slot === 'breakfast')!
    mockAthletes([])
    vi.mocked(fetchGeneratorPool).mockResolvedValue(pool)

    renderChooseAthlete()
    await user.click(await screen.findByRole('button', { name: 'Generate' }))
    expect(screen.getAllByText(originalRecipe.recipeName)).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: `Swap Breakfast on ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][blockedDay.dayOfWeek]}` }))

    expect(await screen.findByText('No compatible breakfast alternative is available within the current nutrition filters and weekly repeat limit.')).toBeInTheDocument()
    expect(screen.getAllByText(originalRecipe.recipeName)).toHaveLength(1)
  })
})
