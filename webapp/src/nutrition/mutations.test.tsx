import { waitFor } from '@testing-library/react'
import { renderHookWithClient } from '../test/renderHook'
import { useLogMeal } from './mutations'

// Hoisted so the vi.mock factory can reach them; `foodInsertError` lets each
// test drive the meal_log_foods insert to success or failure.
const h = vi.hoisted(() => ({
  insertSpy: vi.fn(),
  deleteSpy: vi.fn(),
  foodInsertError: null as unknown,
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      insert: (payload: unknown) => {
        h.insertSpy(table, payload)
        return {
          // meal_logs insert uses .select().single()
          select: () => ({ single: () => Promise.resolve({ data: { id: 'log1' }, error: null }) }),
          // meal_log_foods insert (no .select()) is awaited directly:
          then: (resolve: (v: unknown) => void) =>
            resolve({ error: table === 'meal_log_foods' ? h.foodInsertError : null }),
        }
      },
      // compensating cleanup: delete().eq('id', ...)
      delete: () => ({
        eq: (column: string, value: unknown) => {
          h.deleteSpy(table, column, value)
          return Promise.resolve({ error: null })
        },
      }),
    }),
  },
}))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))

beforeEach(() => {
  h.insertSpy.mockClear()
  h.deleteSpy.mockClear()
  h.foodInsertError = null
})

test('useLogMeal inserts a log then its foods with amount_grams populated', async () => {
  const { result } = renderHookWithClient(() => useLogMeal())
  result.current.mutate({
    mealName: 'Lunch',
    foods: [{ name: 'Rice', amount: 150, unit: 'g', calories: 200, protein_g: 4, carbs_g: 44, fat_g: 1 }],
  })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  const foodsCall = h.insertSpy.mock.calls.find(c => c[0] === 'meal_log_foods')
  expect(foodsCall).toBeTruthy()
  expect(foodsCall![1][0]).toMatchObject({ meal_log_id: 'log1', amount: 150, unit: 'g', amount_grams: 150 })
  // Happy path performs no compensating delete.
  expect(h.deleteSpy).not.toHaveBeenCalled()
})

test('deletes the orphaned meal_logs row when the foods insert fails (FIX B)', async () => {
  h.foodInsertError = { message: 'foods insert failed' }
  const { result } = renderHookWithClient(() => useLogMeal())
  result.current.mutate({
    mealName: 'Lunch',
    foods: [{ name: 'Rice', amount: 150, unit: 'g', calories: 200, protein_g: 4, carbs_g: 44, fat_g: 1 }],
  })
  await waitFor(() => expect(result.current.isError).toBe(true))
  // Original error is not swallowed.
  expect(result.current.error).toMatchObject({ message: 'foods insert failed' })
  // Just-created parent row is removed by id.
  expect(h.deleteSpy).toHaveBeenCalledWith('meal_logs', 'id', 'log1')
})
