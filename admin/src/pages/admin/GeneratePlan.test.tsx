import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { NoticeProvider } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import {
  fetchGeneratedPlan,
  fetchGeneratorPool,
  fetchNutritionTargetVersion,
  saveGeneratedPlan,
} from '../../nutrition/generationApi'
import type { GeneratedPlanRecord } from '../../nutrition/generationApi'
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
}))

vi.mock('../../lib/supabase', () => ({ supabase: { rpc: vi.fn() } }))

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
      <NoticeProvider>
        <MemoryRouter initialEntries={['/admin/nutrition/generated/plan-1']}>
          <Routes>
            <Route path="/admin/nutrition/generated/:id" element={<GeneratePlan />} />
          </Routes>
        </MemoryRouter>
      </NoticeProvider>
    </QueryClientProvider>,
  )
}

function renderCreate() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <NoticeProvider>
        <MemoryRouter initialEntries={['/admin/nutrition/generate?user=athlete-1']}>
          <Routes>
            <Route path="/admin/nutrition/generate" element={<GeneratePlan />} />
          </Routes>
        </MemoryRouter>
      </NoticeProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(fetchGeneratorPool).mockResolvedValue([])
  vi.mocked(fetchNutritionTargetVersion).mockResolvedValue(target)
  vi.mocked(saveGeneratedPlan).mockResolvedValue('plan-1')
  vi.mocked(supabase.rpc).mockResolvedValue({ data: [target], error: null } as never)
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
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(screen.getByRole('textbox', { name: 'Plan name' })).toBeInTheDocument()
    expect(supabase.rpc).toHaveBeenCalledWith('get_active_nutrition_target', { p_user_id: 'athlete-1' })
  })
})
