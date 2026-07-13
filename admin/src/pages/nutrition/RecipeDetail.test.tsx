import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { useRecipe } from '../../nutrition/hooks'
import RecipeDetail from './RecipeDetail'

vi.mock('../../nutrition/hooks', () => ({ useRecipe: vi.fn() }))

it('starts an ingredient-aware meal log from recipe detail', async () => {
  vi.mocked(useRecipe).mockReturnValue({
    data: {
      id: 'recipe-1', name: 'Chicken bowl', description: null,
      calories: 500, protein_g: 40, carbs_g: 50, fat_g: 12,
      photo_url: null, prep_time_min: null, cook_time_min: null, servings: 1,
      difficulty: null, tags: [], featured: false, is_active: true,
      recipe_ingredients: [], recipe_steps: [],
    },
    isLoading: false,
  } as unknown as ReturnType<typeof useRecipe>)

  function LocationProbe() {
    const location = useLocation()
    return <span data-testid="location">{location.pathname}{location.search}</span>
  }
  render(
    <MemoryRouter initialEntries={['/nutrition/recipes/recipe-1']}>
      <Routes><Route path="*" element={<><RecipeDetail /><LocationProbe /></>} /></Routes>
    </MemoryRouter>,
  )

  await userEvent.click(screen.getByRole('button', { name: 'Zapísať tento recept' }))

  expect(screen.getByTestId('location')).toHaveTextContent('/nutrition/log?recipeId=recipe-1')
})
