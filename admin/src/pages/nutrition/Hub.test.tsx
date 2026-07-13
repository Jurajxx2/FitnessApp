import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import Hub from './Hub'

vi.mock('../../nutrition/hooks', () => ({
  useDailySummary: () => ({ data: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }, isLoading: false }),
  useMacroTargets: () => null,
  useRecipes: () => ({ data: [] }),
}))
vi.mock('./Plan', () => ({ default: () => <div>Embedded meal plan</div> }))
vi.mock('./Recipes', () => ({ default: () => <div>Embedded recipes</div> }))

it('keeps today, meal plan, and recipes inside one nutrition hub', async () => {
  render(<MemoryRouter initialEntries={['/nutrition/plan']}><Hub /></MemoryRouter>)
  const user = userEvent.setup()

  expect(screen.getByRole('heading', { name: 'Výživa' })).toBeInTheDocument()
  expect(screen.getByText('Embedded meal plan')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Jedálniček' })).toHaveAttribute('aria-current', 'page')

  await user.click(screen.getByRole('button', { name: 'Recepty' }))

  expect(screen.getByText('Embedded recipes')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Recepty' })).toHaveAttribute('aria-current', 'page')
})
