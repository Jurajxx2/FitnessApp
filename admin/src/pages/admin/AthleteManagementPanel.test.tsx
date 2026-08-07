import type { ComponentProps } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { NoticeProvider } from '../../components/ui'
import { AthleteManagementPanel } from './AthleteManagementPanel'
import type { MealPlan, NutritionTarget, Profile, UserNutritionPreferences, Workout } from '../../types/database'

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

const { rpc, fromMock, insertNutritionTargets, upsertPreferences } = vi.hoisted(() => ({
  rpc: vi.fn(),
  fromMock: vi.fn(),
  insertNutritionTargets: vi.fn(),
  upsertPreferences: vi.fn(),
}))
vi.mock('../../lib/supabase', () => ({ supabase: { rpc, from: fromMock } }))

const BASE_USER: Profile = {
  id: 'user-1',
  email: 'athlete@example.com',
  full_name: 'Ada Athlete',
  age: 30,
  height_cm: 170,
  weight_kg: 65,
  gender: 'female',
  goal: 'stay_fit',
  activity_level: 'moderately_active',
  onboarding_complete: true,
  is_admin: false,
  is_blocked: false,
  access_mode: 'both',
  admin_notes: '',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const BASE_TARGET: NutritionTarget = {
  id: 'target-1',
  user_id: 'user-1',
  source: 'admin',
  created_by: null,
  calories: 2000,
  protein_g: 150,
  carbs_g: 200,
  fat_g: 60,
  fiber_g_min: 25,
  calorie_tol_pct: 5,
  protein_tol_pct: 5,
  carbs_tol_pct: 5,
  fat_tol_pct: 5,
  version: 3,
  is_locked: true,
  effective_from: '2026-01-01T00:00:00Z',
  effective_to: null,
  created_at: '2026-01-01T00:00:00Z',
}

const BASE_PREFERENCES: UserNutritionPreferences = {
  user_id: 'user-1',
  dietary_patterns: ['vegan'],
  excluded_allergens: [],
  disliked_recipe_ids: [],
  favourite_recipe_ids: [],
  meals_per_day: 3,
  include_snack: false,
  meal_distribution: null,
  max_prep_time_min: null,
  max_recipe_repeats_per_week: 2,
  updated_at: '2026-01-01T00:00:00Z',
}

const MEAL_PLANS: Pick<MealPlan, 'id' | 'name'>[] = [
  { id: 'plan-1', name: 'Plan A' },
  { id: 'plan-2', name: 'Plan B' },
]
const WORKOUT_PLANS: Pick<Workout, 'id' | 'name'>[] = [
  { id: 'workout-1', name: 'Push day' },
  { id: 'workout-2', name: 'Pull day' },
]

type Props = ComponentProps<typeof AthleteManagementPanel>

function baseProps(overrides: Partial<Props> = {}): Props {
  return {
    user: BASE_USER,
    mealPlans: MEAL_PLANS,
    workoutPlans: WORKOUT_PLANS,
    currentMealPlanId: 'plan-1',
    currentWorkoutIds: ['workout-1'],
    ...overrides,
  }
}

function Wrapper(props: Props) {
  return (
    <NoticeProvider>
      <MemoryRouter>
        <AthleteManagementPanel {...props} />
      </MemoryRouter>
    </NoticeProvider>
  )
}

function renderPanel(overrides: Partial<Props> = {}) {
  return render(<Wrapper {...baseProps(overrides)} />)
}

// The "Unsaved: X, Y" text is split across a <span> ("Unsaved:") and a
// trailing text node (the label list), so a plain getByText can't match the
// full phrase. "Unsaved:" itself only ever appears in this bar.
function unsavedBarText(): string | null {
  return screen.queryByText('Unsaved:')?.closest('p')?.textContent ?? null
}

function mockQueries(target: NutritionTarget | null, preferences: UserNutritionPreferences) {
  vi.mocked(useQuery).mockImplementation((options: unknown) => {
    const key = (options as { queryKey: unknown[] }).queryKey[0]
    if (key === 'admin-nutrition-target') return { data: target, isLoading: false } as never
    if (key === 'nutrition-preferences') return { data: preferences, isLoading: false } as never
    throw new Error(`AthleteManagementPanel.test: unexpected queryKey "${String(key)}"`)
  })
}

// useMutation is mocked wholesale (per the CheckInsSection.test.tsx convention), so this
// wrapper runs the component's *real* mutationFn/onSuccess/onError against whatever the
// current render closed over — the exact RPC/payload wiring under test — while giving us
// a controllable mutateAsync the orchestrator can sequence and await.
function mockMutations() {
  vi.mocked(useMutation).mockImplementation((options: unknown) => {
    const opts = options as {
      mutationFn: (vars?: unknown) => Promise<unknown>
      onSuccess?: (data: unknown) => void
      onError?: (error: unknown) => void
    }
    return {
      mutate: (variables?: unknown) => { opts.mutationFn(variables) },
      mutateAsync: async (variables?: unknown) => {
        try {
          const result = await opts.mutationFn(variables)
          opts.onSuccess?.(result)
          return result
        } catch (error) {
          opts.onError?.(error)
          throw error
        }
      },
      isPending: false,
    } as never
  })
}

describe('AthleteManagementPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMutations()
    mockQueries(BASE_TARGET, BASE_PREFERENCES)
    rpc.mockResolvedValue({ data: null, error: null })
    fromMock.mockImplementation((table: string) => {
      if (table === 'nutrition_targets') return { insert: insertNutritionTargets }
      if (table === 'user_nutrition_preferences') return { upsert: upsertPreferences }
      throw new Error(`AthleteManagementPanel.test: unexpected supabase.from("${table}")`)
    })
    insertNutritionTargets.mockResolvedValue({ error: null })
    upsertPreferences.mockResolvedValue({ error: null })
  })
  afterEach(() => cleanup())

  it('hides the save bar and the Save changes button when nothing is dirty', () => {
    renderPanel()
    expect(unsavedBarText()).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
  })

  it('editing two sections and saving calls exactly those two mutations, not the other three', async () => {
    renderPanel()

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'New Name' } })
    fireEvent.change(screen.getByLabelText('Calories'), { target: { value: '2200' } })

    const barText = unsavedBarText()
    expect(barText).toContain('User profile and access')
    expect(barText).toContain('Nutrition goals and meal plan')

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(insertNutritionTargets).toHaveBeenCalled())
    expect(rpc).toHaveBeenCalledWith('admin_update_athlete_profile', expect.objectContaining({ p_full_name: 'New Name' }))
    expect(insertNutritionTargets).toHaveBeenCalledWith(expect.objectContaining({ calories: 2200 }))
    expect(rpc).not.toHaveBeenCalledWith('admin_set_user_meal_plan', expect.anything())
    expect(rpc).not.toHaveBeenCalledWith('admin_set_user_workouts', expect.anything())
    expect(upsertPreferences).not.toHaveBeenCalled()
  })

  it('never inserts a new nutrition_targets version when the macros section is untouched', async () => {
    renderPanel()

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Updated Name' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('admin_update_athlete_profile', expect.anything()))
    // The macro-goals mutation inserts a new *versioned* row every time it runs, so a bug
    // that fires it on a clean section would silently pollute the athlete's target history.
    expect(insertNutritionTargets).not.toHaveBeenCalled()
  })

  it('a failing meal-plan save does not prevent an already-applied profile save from being reported as applied', async () => {
    rpc.mockImplementation((fn: string) => {
      if (fn === 'admin_set_user_meal_plan') return Promise.resolve({ data: null, error: new Error('RLS denied for meal plan') })
      return Promise.resolve({ data: null, error: null })
    })
    renderPanel()

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'New Name' } })
    fireEvent.change(screen.getByDisplayValue('Plan A'), { target: { value: 'plan-2' } })
    expect(unsavedBarText()).toContain('Assigned meal plan')

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    const notice = await screen.findByRole('status')
    expect(notice).toHaveTextContent('Assigned meal plan')
    expect(notice).toHaveTextContent('RLS denied for meal plan')
    expect(notice).toHaveTextContent('User profile and access')
    expect(notice).toHaveTextContent('saved successfully')

    expect(rpc).toHaveBeenCalledWith('admin_update_athlete_profile', expect.objectContaining({ p_full_name: 'New Name' }))
    expect(rpc).toHaveBeenCalledWith('admin_set_user_meal_plan', expect.objectContaining({ p_meal_plan_id: 'plan-2' }))
    expect(insertNutritionTargets).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalledWith('admin_set_user_workouts', expect.anything())
    expect(upsertPreferences).not.toHaveBeenCalled()
  })

  it('does not report phantom dirt when a refetch reseeds equal-content objects under new references', () => {
    const { rerender } = renderPanel()
    expect(unsavedBarText()).toBeNull()

    // Simulate a refetch: identical values, brand-new object/array references.
    mockQueries({ ...BASE_TARGET }, { ...BASE_PREFERENCES, dietary_patterns: [...BASE_PREFERENCES.dietary_patterns] })
    rerender(<Wrapper {...baseProps({
      user: { ...BASE_USER },
      mealPlans: [...MEAL_PLANS],
      workoutPlans: [...WORKOUT_PLANS],
      currentWorkoutIds: ['workout-1'],
    })} />)

    expect(unsavedBarText()).toBeNull()
  })

  it('moves the dirty baseline when the query reseeds with the edited value (post-save refetch)', () => {
    const { rerender } = renderPanel()

    fireEvent.change(screen.getByLabelText('Calories'), { target: { value: '2500' } })
    expect(unsavedBarText()).toContain('Nutrition goals and meal plan')

    // Simulate what a real save's invalidateQueries + refetch does: the server now
    // returns the edited value as the new "last-seeded" baseline.
    mockQueries({ ...BASE_TARGET, calories: 2500, version: 4 }, BASE_PREFERENCES)
    rerender(<Wrapper {...baseProps()} />)

    expect(unsavedBarText()).toBeNull()
  })

  it('treats a workout selection as clean after toggling a checkbox off and back on (order-insensitive)', () => {
    renderPanel({ currentWorkoutIds: ['workout-1', 'workout-2'] })

    fireEvent.click(screen.getByLabelText('Push day'))
    expect(unsavedBarText()).toContain('Workout assignments')

    fireEvent.click(screen.getByLabelText('Push day'))
    expect(unsavedBarText()).toBeNull()
  })

  it('disables Save changes while the dirty macros section fails validation', () => {
    renderPanel()

    fireEvent.change(screen.getByLabelText('Calories'), { target: { value: '0' } })

    expect(unsavedBarText()).toContain('Nutrition goals and meal plan')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })

  it('explains why Save changes is disabled when macros are invalid, and clears the explanation once macros are fixed', () => {
    renderPanel()

    fireEvent.change(screen.getByLabelText('Calories'), { target: { value: '0' } })
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    expect(screen.getByText(/Calories must be greater than 0/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Calories'), { target: { value: '2200' } })
    expect(screen.getByRole('button', { name: 'Save changes' })).not.toBeDisabled()
    expect(screen.queryByText(/Calories must be greater than 0/)).not.toBeInTheDocument()
  })

  it('does not show the macros explanation when a different section is dirty', () => {
    renderPanel()

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Changed Name' } })

    expect(screen.getByRole('button', { name: 'Save changes' })).not.toBeDisabled()
    expect(screen.queryByText(/Calories must be greater than 0/)).not.toBeInTheDocument()
  })

  it('registers a beforeunload guard while dirty and removes it once the panel is clean again', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const beforeUnloadAdds = () => addSpy.mock.calls.filter(call => call[0] === 'beforeunload').length
    const beforeUnloadRemoves = () => removeSpy.mock.calls.filter(call => call[0] === 'beforeunload').length

    renderPanel()
    expect(beforeUnloadAdds()).toBe(0)

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Changed Name' } })
    expect(beforeUnloadAdds()).toBe(1)
    expect(beforeUnloadRemoves()).toBe(0)

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: BASE_USER.full_name as string } })
    expect(beforeUnloadRemoves()).toBe(1)
  })

  it('does not re-register the beforeunload guard on every keystroke while a section stays dirty', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const beforeUnloadAdds = () => addSpy.mock.calls.filter(call => call[0] === 'beforeunload').length

    renderPanel()
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Changed Name' } })
    expect(beforeUnloadAdds()).toBe(1)

    // The dirtySections Set is a new reference every render (useMemo keyed on the
    // draft objects), so a second keystroke that keeps the same section dirty must
    // not tear down and re-add the listener — it should still depend on the boolean
    // "is anything dirty", not the Set itself.
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Changed Name Again' } })
    expect(beforeUnloadAdds()).toBe(1)
  })
})
