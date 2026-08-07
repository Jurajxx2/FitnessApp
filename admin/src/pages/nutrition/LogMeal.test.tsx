import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NoticeProvider } from '../../components/ui'
import {
  useActiveMealPlan, useFoodFavorites, useFoodSearch, useMealLog, useRecentFoods, useRecipe,
  useSavedMeals, useSeedFoods,
} from '../../nutrition/hooks'
import {
  useDeleteFoodFavorite, useDeleteMealTemplate, useLogMeal, useSaveFoodFavorite,
  useSaveMealTemplate, useUpdateMealLog,
} from '../../nutrition/mutations'
import { prepareMealPhoto } from '../../nutrition/imagePreparation'
import { analyzeMealPhoto } from '../../nutrition/photoAnalysis'
import LogMeal from './LogMeal'
import { rescaleDraftAmount, draftFromFood } from '../../nutrition/logDraft'

vi.mock('../../nutrition/hooks', () => ({
  useActiveMealPlan: vi.fn(),
  useFoodFavorites: vi.fn(),
  useFoodSearch: vi.fn(),
  useMealLog: vi.fn(),
  useRecentFoods: vi.fn(),
  useRecipe: vi.fn(),
  useSavedMeals: vi.fn(),
  useSeedFoods: vi.fn(),
}))
vi.mock('../../nutrition/mutations', () => ({
  useDeleteFoodFavorite: vi.fn(),
  useDeleteMealTemplate: vi.fn(),
  useLogMeal: vi.fn(),
  useSaveFoodFavorite: vi.fn(),
  useSaveMealTemplate: vi.fn(),
  useUpdateMealLog: vi.fn(),
}))
vi.mock('../../nutrition/imagePreparation', () => ({ prepareMealPhoto: vi.fn() }))
vi.mock('../../nutrition/photoAnalysis', async importOriginal => {
  const original = await importOriginal<typeof import('../../nutrition/photoAnalysis')>()
  return { ...original, analyzeMealPhoto: vi.fn() }
})

const mutateAsync = vi.fn()
const updateMutateAsync = vi.fn()

// useLogMeal/useUpdateMealLog are mocked at the module boundary (this file's
// established convention), but LogMeal.tsx now derives isDirty and the
// deferred navigate() from the mutation's own isPending/isSuccess/data —
// reactive state that only a real useMutation instance updates on its own.
// A flat static mock (the previous `{ mutateAsync, isPending: false }`) can
// never flip isSuccess, so a test built on it can't tell a correctly
// effect-deferred guard apart from a guard that never re-arms at all — it
// would pass either way. This fake reimplements just enough of useMutation's
// public shape, backed by a real useState, so calling `.mutate()` drives a
// genuine success/error transition (and a genuine re-render) the same way
// the real hook does in production.
//
// Deliberately does NOT flush a separate "pending" render before resolving:
// every mock resolver in this file settles near-instantly (already-resolved
// promises), and react-query's own notifyManager batches a near-instant
// mutation's pending and success notifications together in exactly that
// case — no intervening commit, confirmed empirically against Session's and
// CreateWorkout's real (unmocked) mutations. A fake that inserted a free
// intermediate render here would grant LogMeal's guard protection the real
// hook doesn't structurally guarantee, silently hiding a still-real race
// behind a friendlier-than-production test double. isPending is therefore
// always false in this fake — untested here, but nothing in this file reads
// it for assertions.
function useFakeMutation(asyncFn: (variables: unknown) => Promise<unknown>) {
  return function useMutationLike() {
    const [state, setState] = useState<{ status: 'idle' | 'success' | 'error'; data?: unknown }>({ status: 'idle' })
    const mutate = (variables: unknown, options?: { onSuccess?: (data: unknown) => void; onError?: (error: unknown) => void }) => {
      Promise.resolve(asyncFn(variables)).then(
        data => { setState({ status: 'success', data }); options?.onSuccess?.(data) },
        error => { setState({ status: 'error' }); options?.onError?.(error) },
      )
    }
    return {
      mutate,
      mutateAsync: asyncFn,
      // Keep this permanently false — see the block comment above. Modeling a real
      // pending render here (e.g. flipping this true synchronously inside `mutate`
      // before the promise settles) would give the unsaved-changes exit tests below
      // a friendlier guard than production's react-query instance structurally
      // guarantees, and none of them would fail to tell you it happened.
      isPending: false,
      isSuccess: state.status === 'success',
      isError: state.status === 'error',
      data: state.data,
    }
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:meal-photo') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  vi.mocked(useRecipe).mockReturnValue({
    data: {
      id: 'recipe-1',
      name: 'Chicken bowl',
      description: null,
      calories: 540,
      protein_g: 48,
      carbs_g: 56,
      fat_g: 14,
      photo_url: null,
      prep_time_min: 10,
      cook_time_min: 20,
      servings: 1,
      difficulty: null,
      tags: [],
      featured: false,
      is_active: true,
      recipe_ingredients: [
        { id: 'ingredient-1', recipe_id: 'recipe-1', name: 'Chicken', quantity: 180, unit: 'g', calories: 300, protein_g: 45, carbs_g: 0, fat_g: 8, sort_order: 0 },
        { id: 'ingredient-2', recipe_id: 'recipe-1', name: 'Rice', quantity: 200, unit: 'g', calories: 240, protein_g: 3, carbs_g: 56, fat_g: 6, sort_order: 1 },
      ],
    },
    isLoading: false,
  } as unknown as ReturnType<typeof useRecipe>)
  vi.mocked(useActiveMealPlan).mockReturnValue({ data: undefined, isLoading: false } as ReturnType<typeof useActiveMealPlan>)
  vi.mocked(useFoodFavorites).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useFoodFavorites>)
  vi.mocked(useFoodSearch).mockReturnValue({ data: undefined, isLoading: false, isError: false } as unknown as ReturnType<typeof useFoodSearch>)
  vi.mocked(useRecentFoods).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useRecentFoods>)
  vi.mocked(useSavedMeals).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useSavedMeals>)
  vi.mocked(useSeedFoods).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useSeedFoods>)
  vi.mocked(useMealLog).mockReturnValue({
    data: {
      id: 'log-1', user_id: 'user-1', meal_name: 'Obed', meal_type: 'lunch', notes: 'pozn', image_url: null,
      logged_at: '2026-07-13T11:00:00Z',
      meal_log_foods: [{ id: 'food-1', meal_log_id: 'log-1', name: 'Ryža', amount: 150, unit: 'g', amount_grams: 150, calories: 195, protein_g: 4, carbs_g: 42, fat_g: 1 }],
    },
    isLoading: false,
  } as unknown as ReturnType<typeof useMealLog>)
  mutateAsync.mockResolvedValue({ id: 'meal-log-1', photoAttached: true, photoError: null })
  vi.mocked(useLogMeal).mockImplementation(useFakeMutation(mutateAsync) as unknown as typeof useLogMeal)
  updateMutateAsync.mockResolvedValue({ id: 'log-1', photoAttached: false, photoError: null })
  vi.mocked(useUpdateMealLog).mockImplementation(useFakeMutation(updateMutateAsync) as unknown as typeof useUpdateMealLog)
  vi.mocked(useSaveFoodFavorite).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useSaveFoodFavorite>)
  vi.mocked(useDeleteFoodFavorite).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useDeleteFoodFavorite>)
  vi.mocked(useSaveMealTemplate).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useSaveMealTemplate>)
  vi.mocked(useDeleteMealTemplate).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useDeleteMealTemplate>)
  vi.mocked(prepareMealPhoto).mockImplementation(async file => file)
  vi.mocked(analyzeMealPhoto).mockResolvedValue({
    items: [{ name: 'Kuracie mäso', grams: 180, kcal: 300, protein_g: 45, carbs_g: 0, fat_g: 8, confidence: 0.5 }],
  })
})

// useBlocker (used by the unsaved-changes guard) requires a data router — a
// declarative <MemoryRouter> throws its useDataRouterContext invariant. See
// App.test.tsx for the same createMemoryRouter/RouterProvider pattern. The
// router is returned so tests can drive an in-app navigation attempt
// imperatively (LogMeal renders no other internal links to click).
// NoticeProvider is nested inside the router (a pathless layout route, mirroring
// RootLayout in App.tsx) rather than wrapped around RouterProvider, because it now
// calls useLocation() and RouterProvider renders its own tree without accepting children.
function renderLogMealAt(initialPath: string) {
  const router = createMemoryRouter(
    [
      {
        element: <NoticeProvider><Outlet /></NoticeProvider>,
        children: [
          { path: '/nutrition/log', element: <LogMeal /> },
          { path: '/nutrition', element: <p>Nutrition home</p> },
          { path: '/nutrition/history', element: <p>History list</p> },
          { path: '/nutrition/history/:id', element: <p>History detail</p> },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  )
  render(
    <RouterProvider router={router} />,
  )
  return router
}

function renderRecipeLogger() {
  return renderLogMealAt('/nutrition/log?recipeId=recipe-1')
}

function renderManualLogger() {
  return renderLogMealAt('/nutrition/log')
}

// Fresh logs land on the photo-first capture step; the review form (item editor, save bar)
// only appears once the user chooses the manual path. Reused by every manual-flow assertion.
async function enterManualReview(user: ReturnType<typeof userEvent.setup>) {
  renderManualLogger()
  await user.click(screen.getByRole('button', { name: 'Zapísať manuálne' }))
}

describe('LogMeal', () => {
  it('opens on the photo-first capture step for a fresh log', () => {
    renderManualLogger()

    expect(screen.getByText('Odfotiť alebo nahrať jedlo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zapísať manuálne' })).toBeInTheDocument()
    // The whole review form (item editor) stays hidden until the user chooses a path.
    expect(screen.queryByLabelText('Kcal')).not.toBeInTheDocument()
    // Analyse is offered up-front but disabled until a photo is present.
    expect(screen.getByRole('button', { name: 'Analyzovať fotografiu' })).toBeDisabled()
  })

  it('reveals the review step with one expanded editor via manual entry', async () => {
    const user = userEvent.setup()
    await enterManualReview(user)

    expect(screen.getByRole('button', { name: /^Nová položka 1\b/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Kcal')).toBeInTheDocument()
  })

  it('analyses a photo from capture and lands on the pre-filled review', async () => {
    renderManualLogger()
    const user = userEvent.setup()
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')
    await user.upload(input!, new File(['image'], 'lunch.png', { type: 'image/png' }))
    // The preview appearing signals the async photo preparation finished and the button is live.
    await screen.findByAltText('Náhľad jedla')
    await user.click(screen.getByRole('button', { name: 'Analyzovať fotografiu' }))

    expect(await screen.findByText('Kuracie mäso')).toBeInTheDocument()
    expect(screen.getByText('nízka istota')).toBeInTheDocument()
    expect(screen.getByLabelText('Názov jedla')).toHaveValue('Kuracie mäso')
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('prefers the AI meal_name over the client-side name suggestion', async () => {
    vi.mocked(analyzeMealPhoto).mockResolvedValue({
      items: [{ name: 'Kuracie mäso', grams: 180, kcal: 300, protein_g: 45, carbs_g: 0, fat_g: 8, confidence: 0.5 }],
      mealName: 'Kuracie halušky',
    })
    renderManualLogger()
    const user = userEvent.setup()
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')
    await user.upload(input!, new File(['image'], 'lunch.png', { type: 'image/png' }))
    await screen.findByAltText('Náhľad jedla')
    await user.click(screen.getByRole('button', { name: 'Analyzovať fotografiu' }))

    expect(await screen.findByText('Kuracie mäso')).toBeInTheDocument()
    expect(screen.getByLabelText('Názov jedla')).toHaveValue('Kuracie halušky')
  })

  it('adds a favourite from the capture quick-add and enters review', async () => {
    vi.mocked(useFoodFavorites).mockReturnValue({
      data: [{
        id: 'favorite-1', user_id: 'user-1', name: 'Banán', amount: 100, unit: 'g', amount_grams: 100,
        calories: 90, protein_g: 1, carbs_g: 23, fat_g: 0, created_at: '2026-07-20T12:00:00Z',
      }],
      isLoading: false,
    } as unknown as ReturnType<typeof useFoodFavorites>)
    renderManualLogger()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /Banán/ }))

    expect(screen.getByLabelText('Názov jedla')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Banán')).toBeInTheDocument()
  })

  it('uses photo analysis only to fill the draft and waits for explicit save', async () => {
    renderRecipeLogger()
    const user = userEvent.setup()
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')
    await user.upload(input!, new File(['image'], 'lunch.png', { type: 'image/png' }))
    await user.click(await screen.findByRole('button', { name: 'Analyzovať fotografiu' }))

    expect(await screen.findByText('Kuracie mäso')).toBeInTheDocument()
    expect(screen.getByText('nízka istota')).toBeInTheDocument()
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('keeps recipe ingredients separate and submits their nutrition with a photo', async () => {
    renderRecipeLogger()
    const user = userEvent.setup()

    expect(await screen.findByDisplayValue('Chicken bowl')).toBeInTheDocument()
    expect(screen.getByText('Chicken')).toBeInTheDocument()
    expect(screen.getByText('Rice')).toBeInTheDocument()

    const photo = new File(['image'], 'lunch.png', { type: 'image/png' })
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')
    expect(input).not.toBeNull()
    await user.upload(input!, photo)
    expect(await screen.findByAltText('Náhľad jedla')).toHaveAttribute('src', 'blob:meal-photo')

    await user.click(screen.getByRole('button', { name: 'Uložiť jedlo' }))

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      mealName: 'Chicken bowl',
      mealType: expect.any(String),
      loggedAt: expect.any(String),
      foods: [
        { name: 'Chicken', amount: 180, unit: 'g', calories: 300, protein_g: 45, carbs_g: 0, fat_g: 8 },
        { name: 'Rice', amount: 200, unit: 'g', calories: 240, protein_g: 3, carbs_g: 56, fat_g: 6 },
      ],
      notes: undefined,
      photoFile: photo,
    })))
    expect(await screen.findByText('Nutrition home')).toBeInTheDocument()
  })

  it('rescales nutrition when an ingredient amount changes', () => {
    const draft = draftFromFood({ name: 'Rice', amount: 100, unit: 'g', calories: 130, protein_g: 3, carbs_g: 28, fat_g: 1 })
    expect(rescaleDraftAmount(draft, 250)).toMatchObject({ calories: 325, protein_g: 7.5, carbs_g: 70, fat_g: 2.5 })
  })

  it('toggles a named food item open and closed', async () => {
    renderRecipeLogger()
    const user = userEvent.setup()
    const chickenToggle = await screen.findByRole('button', { name: /^Chicken\b/ })

    expect(chickenToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByDisplayValue('Chicken')).not.toBeInTheDocument()

    await user.click(chickenToggle)
    expect(chickenToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByDisplayValue('Chicken')).toBeInTheDocument()

    await user.click(chickenToggle)
    expect(chickenToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByDisplayValue('Chicken')).not.toBeInTheDocument()
  })

  it('keeps the first editor expanded while its name is typed', async () => {
    const user = userEvent.setup()
    await enterManualReview(user)
    const itemToggle = screen.getByRole('button', { name: /^Nová položka 1\b/ })

    expect(itemToggle).toHaveAttribute('aria-expanded', 'true')
    await user.type(screen.getByLabelText('Názov'), 'Ryža')

    expect(itemToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Kcal')).toBeInTheDocument()
  })

  it('always appends a manual item and preserves an incomplete unnamed row', async () => {
    const user = userEvent.setup()
    await enterManualReview(user)
    const firstCalories = screen.getByLabelText('Kcal')
    await user.clear(firstCalories)
    await user.type(firstCalories, '123')

    await user.click(screen.getByRole('button', { name: 'Pridať vlastnú položku' }))

    expect(screen.getAllByLabelText('Názov')).toHaveLength(2)
    expect(screen.getAllByLabelText('Kcal')[0]).toHaveValue(123)
  })

  it('quick-add replaces only a pristine placeholder', async () => {
    vi.mocked(useFoodFavorites).mockReturnValue({
      data: [{
        id: 'favorite-1', user_id: 'user-1', name: 'Banán', amount: 100, unit: 'g', amount_grams: 100,
        calories: 90, protein_g: 1, carbs_g: 23, fat_g: 0, created_at: '2026-07-20T12:00:00Z',
      }],
      isLoading: false,
    } as unknown as ReturnType<typeof useFoodFavorites>)
    const user = userEvent.setup()
    await enterManualReview(user)

    await user.click(screen.getByRole('button', { name: /Banán/ }))

    expect(screen.getAllByLabelText('Názov')).toHaveLength(1)
    expect(screen.getByLabelText('Názov')).toHaveValue('Banán')
  })

  it('quick-add preserves a partially edited unnamed placeholder', async () => {
    vi.mocked(useFoodFavorites).mockReturnValue({
      data: [{
        id: 'favorite-1', user_id: 'user-1', name: 'Banán', amount: 100, unit: 'g', amount_grams: 100,
        calories: 90, protein_g: 1, carbs_g: 23, fat_g: 0, created_at: '2026-07-20T12:00:00Z',
      }],
      isLoading: false,
    } as unknown as ReturnType<typeof useFoodFavorites>)
    const user = userEvent.setup()
    await enterManualReview(user)
    const firstCalories = screen.getByLabelText('Kcal')
    await user.clear(firstCalories)
    await user.type(firstCalories, '12')

    await user.click(screen.getByRole('button', { name: /Banán/ }))

    expect(screen.getAllByLabelText('Názov')).toHaveLength(2)
    expect(screen.getAllByLabelText('Názov')[0]).toHaveValue('')
    expect(screen.getAllByLabelText('Názov')[1]).toHaveValue('Banán')
    expect(screen.getAllByLabelText('Kcal')[0]).toHaveValue(12)
  })

  it('leaves one expanded blank editor after removing the final item', async () => {
    const user = userEvent.setup()
    await enterManualReview(user)

    await user.click(screen.getByRole('button', { name: 'Odstrániť položku 1' }))

    expect(screen.getAllByLabelText('Názov')).toHaveLength(1)
    expect(screen.getByLabelText('Názov')).toHaveValue('')
    expect(screen.getByRole('button', { name: /^Nová položka 1\b/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('returns to capture via the back affordance without discarding the draft', async () => {
    const user = userEvent.setup()
    await enterManualReview(user)
    await user.type(screen.getByLabelText('Názov jedla'), 'Ryžový obed')

    await user.click(screen.getByRole('button', { name: /Späť na fotografiu/ }))

    // The capture step is shown again and the review form is gone.
    expect(screen.getByText('Odfotiť alebo nahrať jedlo')).toBeInTheDocument()
    expect(screen.queryByLabelText('Názov jedla')).not.toBeInTheDocument()

    // Re-entering review keeps the previously typed name — nothing was discarded.
    await user.click(screen.getByRole('button', { name: 'Zapísať manuálne' }))
    expect(screen.getByLabelText('Názov jedla')).toHaveValue('Ryžový obed')
  })

  it('omits the back-to-photo affordance for a prefill that starts in review', async () => {
    renderRecipeLogger()

    expect(await screen.findByDisplayValue('Chicken bowl')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Späť na fotografiu/ })).not.toBeInTheDocument()
  })

  it('advances to review from a capture recents quick-add with the item present', async () => {
    vi.mocked(useRecentFoods).mockReturnValue({
      data: [{
        key: 'recent-jablko', name: 'Jablko', amount: 100, unit: 'g', amount_grams: 100,
        calories: 52, protein_g: 0.3, carbs_g: 14, fat_g: 0.2,
      }],
      isLoading: false,
    } as unknown as ReturnType<typeof useRecentFoods>)
    renderManualLogger()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /Jablko/ }))

    expect(screen.getByLabelText('Názov jedla')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Jablko')).toBeInTheDocument()
  })
})

const TOFU_RESULT = {
  id: 'food-tofu', name: 'Tofu', calories: 144, protein_g: 15, carbs_g: 3, fat_g: 8,
  serving_size: 100, serving_unit: 'g', brand: null, is_verified: true,
}

describe('LogMeal food search', () => {
  it('keeps the search input mounted and focused while a query is loading', async () => {
    vi.mocked(useFoodSearch).mockReturnValue({ data: undefined, isLoading: true, isError: false } as unknown as ReturnType<typeof useFoodSearch>)
    const user = userEvent.setup()
    await enterManualReview(user)
    const input = screen.getByLabelText('Hľadať potravinu')

    await user.type(input, 'ry')

    expect(document.body.contains(input)).toBe(true)
    expect(document.activeElement).toBe(input)
  })

  it('renders result rows once a 2+ character query resolves', async () => {
    vi.mocked(useFoodSearch).mockReturnValue({ data: [TOFU_RESULT], isLoading: false, isError: false } as unknown as ReturnType<typeof useFoodSearch>)
    const user = userEvent.setup()
    await enterManualReview(user)

    await user.type(screen.getByLabelText('Hľadať potravinu'), 'tofu')

    expect(await screen.findByRole('button', { name: /^Tofu\b.*144 kcal/ })).toBeInTheDocument()
  })

  it('adds a search result to the meal via the shared add path, with matching macros', async () => {
    vi.mocked(useFoodSearch).mockReturnValue({ data: [TOFU_RESULT], isLoading: false, isError: false } as unknown as ReturnType<typeof useFoodSearch>)
    const user = userEvent.setup()
    await enterManualReview(user)
    await user.type(screen.getByLabelText('Hľadať potravinu'), 'tofu')
    const resultButton = await screen.findByRole('button', { name: /^Tofu\b.*144 kcal/ })

    await user.click(resultButton)

    expect(screen.getByLabelText('Názov')).toHaveValue('Tofu')
    expect(screen.getByLabelText('Kcal')).toHaveValue(144)
    expect(screen.getByLabelText('Bielkoviny')).toHaveValue(15)
    expect(screen.getByLabelText('Sacharidy')).toHaveValue(3)
    expect(screen.getByLabelText('Tuky')).toHaveValue(8)
  })

  it('shows the zero-result message for an empty result set while the input stays mounted', async () => {
    vi.mocked(useFoodSearch).mockReturnValue({ data: [], isLoading: false, isError: false } as unknown as ReturnType<typeof useFoodSearch>)
    const user = userEvent.setup()
    await enterManualReview(user)
    const input = screen.getByLabelText('Hľadať potravinu')

    await user.type(input, 'xyz')

    expect(await screen.findByText('Žiadna potravina nezodpovedá hľadaniu.')).toBeInTheDocument()
    // Same DOM node, not a remounted replacement — the input never disappears mid-query.
    expect(screen.getByLabelText('Hľadať potravinu')).toBe(input)
  })
})

function renderEditLogger() {
  return renderLogMealAt('/nutrition/log?logId=log-1')
}

describe('LogMeal edit mode', () => {
  it('prefills name, notes and foods from the log referenced by ?logId', async () => {
    renderEditLogger()

    expect(await screen.findByLabelText('Názov jedla')).toHaveValue('Obed')
    expect(screen.getByRole('heading', { name: 'Upraviť jedlo' })).toBeInTheDocument()
    expect(screen.getByText('Ryža')).toBeInTheDocument()
    expect(screen.getByLabelText('Poznámka')).toHaveValue('pozn')
  })

  it('updates instead of inserting on save', async () => {
    renderEditLogger()
    const user = userEvent.setup()
    await screen.findByLabelText('Názov jedla')

    await user.click(screen.getByRole('button', { name: 'Uložiť zmeny' }))

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      logId: 'log-1',
      mealName: 'Obed',
      existingImageUrl: null,
    })))
    expect(mutateAsync).not.toHaveBeenCalled()
    expect(await screen.findByText('History detail')).toBeInTheDocument()
  })
})

describe('LogMeal save bar clears the mobile nav', () => {
  // jsdom performs no layout, so this cannot prove the save bar and the fixed
  // athlete bottom nav no longer visually overlap — only a real browser
  // layout engine could. What it does prove: the save bar's container no
  // longer sits at the literal `bottom-0` that put it at the same edge as
  // the nav (the exact regression an external review flagged), it is offset
  // by the nav's derived height instead, its fixed positioning is scoped to
  // the same md breakpoint the nav uses (not the old, narrower sm), and the
  // save button itself meets the 44px athlete touch-target floor.
  it('does not reintroduce bottom-0 on the fixed save bar, and keeps its breakpoint aligned with the nav', async () => {
    const user = userEvent.setup()
    await enterManualReview(user)
    const saveButton = screen.getByRole('button', { name: 'Uložiť jedlo' })
    const saveBar = saveButton.parentElement as HTMLElement

    expect(saveBar.className).not.toMatch(/(?:^|\s)bottom-0(?:\s|$)/)
    expect(saveBar.className).toContain('bottom-[calc(4rem+env(safe-area-inset-bottom))]')
    // The bar must stay fixed for exactly as long as the nav stays fixed
    // (AthleteAppShell.tsx's nav is `md:hidden`) — the original bug was this
    // bar going static at sm (640px) while the nav stayed fixed until md
    // (768px), leaving the 640-767px band broken too.
    expect(saveBar.className).toContain('md:static')
    expect(saveBar.className).not.toMatch(/(?:^|\s)sm:static(?:\s|$)/)
  })

  it('gives the save button a >=44px min-height, since Button.tsx only guarantees min-h-10 (40px)', async () => {
    const user = userEvent.setup()
    await enterManualReview(user)
    const saveButton = screen.getByRole('button', { name: 'Uložiť jedlo' })

    expect(saveButton).toHaveClass('min-h-11')
  })

  it('does not double-count the bottom nav clearance the shell (AthleteAppShell pb-20) already reserves', async () => {
    // Regression guard: this page renders inside AthleteAppShell's <main>, which already
    // pads pb-20 (5rem) for the fixed bottom nav. This page's own bottom padding must only
    // cover what that leaves owed for the save bar sitting above it, not re-pay for the nav
    // too — the previous 9rem here, stacked on top of the shell's 5rem, produced ~14rem of
    // dead scroll space for an ~8.3rem requirement.
    const user = userEvent.setup()
    await enterManualReview(user)
    const heading = screen.getByRole('heading', { name: 'Zapísať jedlo' })
    const pageWrapper = heading.parentElement!.parentElement as HTMLElement

    expect(pageWrapper.className).toContain('pb-[calc(5rem+env(safe-area-inset-bottom))]')
    expect(pageWrapper.className).not.toContain('pb-[calc(9rem')
  })
})

describe('LogMeal unsaved-changes guard', () => {
  it('blocks an in-app navigation attempt once an item has been entered', async () => {
    const user = userEvent.setup()
    const router = renderManualLogger()
    await user.click(screen.getByRole('button', { name: 'Zapísať manuálne' }))

    await user.type(screen.getByLabelText('Názov'), 'Ryža')

    // Simulate the user tapping away (a nav link or the browser back button) —
    // this test doesn't exercise a link LogMeal itself renders, so drive the
    // router directly, the same technique used in Session.test.tsx.
    await act(async () => { router.navigate('/nutrition') })

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Zahodiť neuložené zmeny?')).toBeInTheDocument()
    expect(within(dialog).getByText('Máš rozpracované zmeny, ktoré sa neuložili. Ak odídeš, prídeš o ne.')).toBeInTheDocument()
    expect(screen.queryByText('Nutrition home')).not.toBeInTheDocument()
  })

  it('Zostať keeps the page and the typed data; a later Odísť leaves', async () => {
    const user = userEvent.setup()
    const router = renderManualLogger()
    await user.click(screen.getByRole('button', { name: 'Zapísať manuálne' }))
    await user.type(screen.getByLabelText('Názov'), 'Ryža')

    await act(async () => { router.navigate('/nutrition') })
    const firstDialog = await screen.findByRole('dialog')
    await user.click(within(firstDialog).getByRole('button', { name: 'Zostať' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Nutrition home')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Názov')).toHaveValue('Ryža')

    // Still dirty, so a second attempt must block again — proves Zostať reset
    // the blocker instead of leaving it permanently unblocked.
    await act(async () => { router.navigate('/nutrition') })
    const secondDialog = await screen.findByRole('dialog')
    await user.click(within(secondDialog).getByRole('button', { name: 'Odísť' }))

    expect(await screen.findByText('Nutrition home')).toBeInTheDocument()
  })

  it('does not block navigation before any photo/item has been entered', async () => {
    const router = renderManualLogger()
    await act(async () => { router.navigate('/nutrition') })

    expect(await screen.findByText('Nutrition home')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('navigates to /nutrition with no unsaved-changes dialog after a successful save', async () => {
    const user = userEvent.setup()
    renderManualLogger()
    await user.click(screen.getByRole('button', { name: 'Zapísať manuálne' }))

    await user.type(screen.getByLabelText('Názov jedla'), 'Obed')
    await user.type(screen.getByLabelText('Názov'), 'Ryža')

    await user.click(screen.getByRole('button', { name: 'Uložiť jedlo' }))

    expect(await screen.findByText('Nutrition home')).toBeInTheDocument()
    expect(screen.queryByText('Zahodiť neuložené zmeny?')).not.toBeInTheDocument()
  })

  // Regression test: the prefill effect in edit mode deliberately does not call
  // markDirty (prefilling isn't a user edit), so only the field handlers themselves
  // can arm the guard. Before this fix, mealType/logDate/logTime/notes changes in
  // edit mode were silently lossy — hasUnsavedChanges stayed false and an attempted
  // navigation left with no prompt at all.
  it('edit mode: changing only the time arms the unsaved-changes guard', async () => {
    const router = renderEditLogger()
    await screen.findByLabelText('Názov jedla')

    fireEvent.change(screen.getByLabelText('Čas'), { target: { value: '18:30' } })

    await act(async () => { router.navigate('/nutrition') })

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Zahodiť neuložené zmeny?')).toBeInTheDocument()
    expect(screen.queryByText('Nutrition home')).not.toBeInTheDocument()
  })
})
