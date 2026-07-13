import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { useActiveMealPlan } from '../../nutrition/hooks'
import Plan from './Plan'

vi.mock('../../nutrition/hooks', () => ({ useActiveMealPlan: vi.fn() }))

const mockUseActiveMealPlan = vi.mocked(useActiveMealPlan)

beforeEach(() => {
  mockUseActiveMealPlan.mockReturnValue({
    data: {
      id: 'plan-1',
      name: 'Test plan',
      description: null,
      valid_from: null,
      valid_to: null,
      meals: [{
        id: 'meal-1',
        meal_plan_id: 'plan-1',
        name: 'BREAKFAST',
        time_of_day: '08:00',
        sort_order: 0,
        day_of_week: null,
        meal_foods: [
          { id: 'food-1', meal_id: 'meal-1', name: 'Protein pancakes', amount_grams: 100, calories: 420, protein_g: 30, carbs_g: 45, fat_g: 12 },
          { id: 'food-2', meal_id: 'meal-1', name: 'Archived recipe snapshot', amount_grams: 100, calories: 300, protein_g: 20, carbs_g: 35, fat_g: 8 },
        ],
        meal_plan_recipes: [
          { id: 'slot-1', recipe_id: 'recipe-1', snapshot_recipe_name: 'Protein pancakes' },
          { id: 'slot-2', recipe_id: null, snapshot_recipe_name: 'Archived recipe snapshot' },
        ],
      }],
    },
    isLoading: false,
  } as ReturnType<typeof useActiveMealPlan>)
})

test('links planned recipes to their athlete recipe detail page', () => {
  function LocationProbe() {
    return <span data-testid="location">{useLocation().pathname}{useLocation().search}</span>
  }
  render(<MemoryRouter initialEntries={['/nutrition/plan']}><Plan /><LocationProbe /></MemoryRouter>)

  expect(screen.getByRole('link', { name: 'Otvoriť recept Protein pancakes' }))
    .toHaveAttribute('href', '/nutrition/recipes/recipe-1')
  expect(screen.queryByRole('link', { name: 'Otvoriť recept Archived recipe snapshot' }))
    .not.toBeInTheDocument()
})

test('starts a meal log prefilled from the selected meal card', async () => {
  function LocationProbe() {
    const location = useLocation()
    return <span data-testid="location">{location.pathname}{location.search}</span>
  }
  render(<MemoryRouter initialEntries={['/nutrition/plan']}><Plan /><LocationProbe /></MemoryRouter>)

  await userEvent.click(screen.getByRole('button', { name: 'Zapísať toto jedlo' }))

  expect(screen.getByTestId('location')).toHaveTextContent('/nutrition/log?mealId=meal-1')
})
