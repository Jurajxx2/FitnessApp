import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Recipes from './Recipes'

const toggleMutate = vi.fn()
vi.mock('../../nutrition/hooks', () => ({
  useRecipes: () => ({ isLoading: false, data: [
    { id: 'r1', name: 'Protein oats', calories: 350, protein_g: 30, carbs_g: 40, fat_g: 8, photo_url: null, featured: true, tags: [], servings: 1, difficulty: null, description: null, prep_time_min: null, cook_time_min: null },
  ] }),
  useFavorites: () => ({ data: new Set<string>() }),
}))
vi.mock('../../nutrition/mutations', () => ({ useToggleFavorite: () => ({ mutate: toggleMutate }) }))

test('Recipes lists a recipe and toggles favorite without navigating', async () => {
  render(<MemoryRouter><Recipes /></MemoryRouter>)
  expect(screen.getByText('Protein oats')).toBeInTheDocument()
  await userEvent.click(screen.getByLabelText('favorite'))
  expect(toggleMutate).toHaveBeenCalledWith({ recipeId: 'r1', isFavorite: false })
})
