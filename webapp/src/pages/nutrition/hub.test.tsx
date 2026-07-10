import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Hub from './Hub'

vi.mock('../../nutrition/hooks', () => ({
  useDailySummary: () => ({ data: { calories: 800, protein_g: 40, carbs_g: 90, fat_g: 20 }, isLoading: false }),
  useMacroTargets: () => ({ calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 60 }),
  useRecipes: () => ({ data: [] }),
}))

test('Hub shows the day summary and a log CTA', () => {
  render(<MemoryRouter><Hub /></MemoryRouter>)
  expect(screen.getByText('800')).toBeInTheDocument()
  expect(screen.getByText('+ Zapísať jedlo')).toBeInTheDocument()
})
