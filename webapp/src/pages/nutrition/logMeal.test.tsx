import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import LogMeal from './LogMeal'

const mutateAsync = vi.fn().mockResolvedValue(undefined)

vi.mock('../../nutrition/hooks', () => ({
  useFoodSearch: () => ({
    isFetching: false,
    data: [{
      id: 'f1',
      name: 'Rice',
      calories: 130,
      protein_g: 2.7,
      carbs_g: 28,
      fat_g: 0.3,
      serving_size: 100,
      serving_unit: 'g',
      brand: null,
      is_verified: true,
    }],
  }),
}))

vi.mock('../../nutrition/mutations', () => ({
  useLogMeal: () => ({ mutateAsync, isPending: false }),
}))

test('adds a food, names the meal, and saves it', async () => {
  const user = userEvent.setup()

  render(<MemoryRouter><LogMeal /></MemoryRouter>)

  await user.type(screen.getByLabelText('Názov jedla'), 'Obed')
  await user.click(screen.getByText(/Rice/))
  await user.click(screen.getByRole('button', { name: 'Uložiť jedlo' }))

  expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
    mealName: 'Obed',
    foods: [expect.objectContaining({ name: 'Rice', amount: 100, unit: 'g', calories: 130 })],
  }))
})

test('clearing the quantity to 0 then retyping recovers the macros (FIX A)', async () => {
  const user = userEvent.setup()
  mutateAsync.mockClear()

  render(<MemoryRouter><LogMeal /></MemoryRouter>)

  await user.type(screen.getByLabelText('Názov jedla'), 'Obed')
  await user.click(screen.getByText(/Rice/))

  // Rice: 130 kcal / 100 g. Clear the amount (-> 0 kcal), then retype 200 g.
  const amountInput = screen.getByLabelText('Množstvo Rice')
  fireEvent.change(amountInput, { target: { value: '' } })     // Number('') === 0 -> zeroes macros
  fireEvent.change(amountInput, { target: { value: '200' } })  // must re-scale from the BASE food

  await user.click(screen.getByRole('button', { name: 'Uložiť jedlo' }))

  // 200 g of Rice = 260 kcal (bug would save 0 kcal).
  expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
    mealName: 'Obed',
    foods: [expect.objectContaining({ name: 'Rice', amount: 200, unit: 'g', calories: 260 })],
  }))
})
