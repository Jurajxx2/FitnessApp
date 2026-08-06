import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { useFavorites, useRecipe } from '../../nutrition/hooks'
import { useToggleFavorite } from '../../nutrition/mutations'
import RecipeDetail from './RecipeDetail'

vi.mock('../../nutrition/hooks', () => ({ useRecipe: vi.fn(), useFavorites: vi.fn() }))
vi.mock('../../nutrition/mutations', () => ({ useToggleFavorite: vi.fn() }))

const recipe = {
  id: 'recipe-1', name: 'Chicken bowl', description: null,
  calories: 500, protein_g: 40, carbs_g: 50, fat_g: 12,
  photo_url: null, prep_time_min: null, cook_time_min: null, servings: 1,
  difficulty: null, tags: [], featured: false, is_active: true,
  recipe_ingredients: [], recipe_steps: [],
}

beforeEach(() => {
  vi.mocked(useRecipe).mockReturnValue({ data: recipe, isLoading: false } as unknown as ReturnType<typeof useRecipe>)
  vi.mocked(useFavorites).mockReturnValue({ data: new Set() } as unknown as ReturnType<typeof useFavorites>)
})

function renderDetail() {
  function LocationProbe() {
    const location = useLocation()
    return <span data-testid="location">{location.pathname}{location.search}</span>
  }
  return render(
    <MemoryRouter initialEntries={['/nutrition/recipes/recipe-1']}>
      <Routes><Route path="*" element={<><RecipeDetail /><LocationProbe /></>} /></Routes>
    </MemoryRouter>,
  )
}

it('starts an ingredient-aware meal log from recipe detail', async () => {
  vi.mocked(useToggleFavorite).mockReturnValue({ mutate: vi.fn() } as unknown as ReturnType<typeof useToggleFavorite>)
  renderDetail()

  await userEvent.click(screen.getByRole('button', { name: 'Zapísať tento recept' }))

  expect(screen.getByTestId('location')).toHaveTextContent('/nutrition/log?recipeId=recipe-1')
})

it('renders the favourite toggle and calls the toggle mutation with the recipe id when not favourited', async () => {
  const mutate = vi.fn()
  vi.mocked(useToggleFavorite).mockReturnValue({ mutate } as unknown as ReturnType<typeof useToggleFavorite>)
  renderDetail()

  const button = screen.getByRole('button', { name: 'Pridať medzi obľúbené' })
  await userEvent.click(button)

  expect(mutate).toHaveBeenCalledWith({ recipeId: 'recipe-1', isFavorite: false })
})

it('shows the "remove from favourites" label and toggles off when already favourited', async () => {
  const mutate = vi.fn()
  vi.mocked(useFavorites).mockReturnValue({ data: new Set(['recipe-1']) } as unknown as ReturnType<typeof useFavorites>)
  vi.mocked(useToggleFavorite).mockReturnValue({ mutate } as unknown as ReturnType<typeof useToggleFavorite>)
  renderDetail()

  const button = screen.getByRole('button', { name: 'Odobrať z obľúbených' })
  await userEvent.click(button)

  expect(mutate).toHaveBeenCalledWith({ recipeId: 'recipe-1', isFavorite: true })
})
