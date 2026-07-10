import { render, screen } from '@testing-library/react'
import Plan from './Plan'

vi.mock('../../nutrition/hooks', () => ({
  useActiveMealPlan: () => ({
    isLoading: false,
    data: {
      id: 'p', name: 'Cutting plan', description: null, valid_from: null, valid_to: null,
      meals: [{ id: 'm1', meal_plan_id: 'p', name: 'Breakfast', time_of_day: '08:00', sort_order: 0, day_of_week: null,
        meal_foods: [{ id: 'f1', meal_id: 'm1', name: 'Oats', amount_grams: 80, calories: 300, protein_g: 10, carbs_g: 50, fat_g: 6 }] }],
    },
  }),
}))

test('Plan shows plan name and a meal with its food', () => {
  render(<Plan />)
  expect(screen.getByText('Cutting plan')).toBeInTheDocument()
  expect(screen.getByText('Breakfast')).toBeInTheDocument()
  expect(screen.getByText('Oats')).toBeInTheDocument()
})
