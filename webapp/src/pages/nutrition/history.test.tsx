import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import History from './History'

vi.mock('../../nutrition/hooks', () => ({
  useMealHistory: () => ({
    isLoading: false,
    data: [{
      id: 'l1',
      user_id: 'u',
      meal_name: 'Obed',
      notes: null,
      image_url: null,
      logged_at: '2026-07-10T11:00:00Z',
      meal_log_foods: [{
        id: 'f',
        meal_log_id: 'l1',
        name: 'Rice',
        amount: 150,
        unit: 'g',
        amount_grams: 150,
        calories: 200,
        protein_g: 4,
        carbs_g: 44,
        fat_g: 1,
      }],
    }],
  }),
}))

test('History groups a logged meal under its date', () => {
  render(<MemoryRouter><History /></MemoryRouter>)

  expect(screen.getByText('2026-07-10')).toBeInTheDocument()
  expect(screen.getByText('Obed')).toBeInTheDocument()
  expect(screen.getByText('200')).toBeInTheDocument()
})
