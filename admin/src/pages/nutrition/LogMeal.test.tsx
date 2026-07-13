import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NoticeProvider } from '../../components/ui'
import { useActiveMealPlan, useFoodSearch, useRecipe } from '../../nutrition/hooks'
import { useLogMeal } from '../../nutrition/mutations'
import LogMeal, { rescaleDraftAmount, draftFromFood } from './LogMeal'

vi.mock('../../nutrition/hooks', () => ({
  useActiveMealPlan: vi.fn(),
  useFoodSearch: vi.fn(),
  useRecipe: vi.fn(),
}))
vi.mock('../../nutrition/mutations', () => ({ useLogMeal: vi.fn() }))

const mutateAsync = vi.fn()

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
  vi.mocked(useFoodSearch).mockReturnValue({ data: [], isFetching: false } as unknown as ReturnType<typeof useFoodSearch>)
  mutateAsync.mockResolvedValue({ id: 'meal-log-1', photoAttached: true, photoError: null })
  vi.mocked(useLogMeal).mockReturnValue({ mutateAsync, isPending: false, isError: false } as unknown as ReturnType<typeof useLogMeal>)
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
  it('keeps recipe ingredients separate and submits their nutrition with a photo', async () => {
    renderRecipeLogger()
    const user = userEvent.setup()

    expect(await screen.findByDisplayValue('Chicken bowl')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Chicken')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Rice')).toBeInTheDocument()

    const photo = new File(['image'], 'lunch.png', { type: 'image/png' })
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')
    expect(input).not.toBeNull()
    await user.upload(input!, photo)
    expect(await screen.findByAltText('Náhľad jedla')).toHaveAttribute('src', 'blob:meal-photo')

    await user.click(screen.getByRole('button', { name: 'Uložiť jedlo' }))

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({
      mealName: 'Chicken bowl',
      foods: [
        { name: 'Chicken', amount: 180, unit: 'g', calories: 300, protein_g: 45, carbs_g: 0, fat_g: 8 },
        { name: 'Rice', amount: 200, unit: 'g', calories: 240, protein_g: 3, carbs_g: 56, fat_g: 6 },
      ],
      notes: undefined,
      photoFile: photo,
    }))
    expect(await screen.findByText('Nutrition home')).toBeInTheDocument()
  })

  it('rescales nutrition when an ingredient amount changes', () => {
    const draft = draftFromFood({ name: 'Rice', amount: 100, unit: 'g', calories: 130, protein_g: 3, carbs_g: 28, fat_g: 1 })
    expect(rescaleDraftAmount(draft, 250)).toMatchObject({ calories: 325, protein_g: 7.5, carbs_g: 70, fat_g: 2.5 })
  })
})
