import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NoticeProvider } from '../../components/ui'
import {
  useActiveMealPlan, useFoodFavorites, useMealHistory, useRecentFoods, useRecipe,
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
  useMealHistory: vi.fn(),
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
  vi.mocked(useRecentFoods).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useRecentFoods>)
  vi.mocked(useSavedMeals).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useSavedMeals>)
  vi.mocked(useSeedFoods).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useSeedFoods>)
  vi.mocked(useMealHistory).mockReturnValue({
    data: [{
      id: 'log-1', user_id: 'user-1', meal_name: 'Obed', meal_type: 'lunch', notes: 'pozn', image_url: null,
      logged_at: '2026-07-13T11:00:00Z',
      meal_log_foods: [{ id: 'food-1', meal_log_id: 'log-1', name: 'Ryža', amount: 150, unit: 'g', amount_grams: 150, calories: 195, protein_g: 4, carbs_g: 42, fat_g: 1 }],
    }],
    isLoading: false,
  } as unknown as ReturnType<typeof useMealHistory>)
  mutateAsync.mockResolvedValue({ id: 'meal-log-1', photoAttached: true, photoError: null })
  vi.mocked(useLogMeal).mockReturnValue({ mutateAsync, isPending: false, isError: false } as unknown as ReturnType<typeof useLogMeal>)
  updateMutateAsync.mockResolvedValue({ id: 'log-1', photoAttached: false, photoError: null })
  vi.mocked(useUpdateMealLog).mockReturnValue({ mutateAsync: updateMutateAsync, isPending: false, isError: false } as unknown as ReturnType<typeof useUpdateMealLog>)
  vi.mocked(useSaveFoodFavorite).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useSaveFoodFavorite>)
  vi.mocked(useDeleteFoodFavorite).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useDeleteFoodFavorite>)
  vi.mocked(useSaveMealTemplate).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useSaveMealTemplate>)
  vi.mocked(useDeleteMealTemplate).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useDeleteMealTemplate>)
  vi.mocked(prepareMealPhoto).mockImplementation(async file => file)
  vi.mocked(analyzeMealPhoto).mockResolvedValue({
    items: [{ name: 'Kuracie mäso', grams: 180, kcal: 300, protein_g: 45, carbs_g: 0, fat_g: 8, confidence: 0.5 }],
  })
})

function renderRecipeLogger() {
  render(
    <NoticeProvider>
      <MemoryRouter initialEntries={['/nutrition/log?recipeId=recipe-1']}>
        <Routes>
          <Route path="/nutrition/log" element={<LogMeal />} />
          <Route path="/nutrition" element={<p>Nutrition home</p>} />
        </Routes>
      </MemoryRouter>
    </NoticeProvider>,
  )
}

describe('LogMeal', () => {
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
})

function renderEditLogger() {
  render(
    <NoticeProvider>
      <MemoryRouter initialEntries={['/nutrition/log?logId=log-1']}>
        <Routes>
          <Route path="/nutrition/log" element={<LogMeal />} />
          <Route path="/nutrition/history/:id" element={<p>History detail</p>} />
        </Routes>
      </MemoryRouter>
    </NoticeProvider>,
  )
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
