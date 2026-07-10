import { waitFor } from '@testing-library/react'
import { renderHookWithClient } from '../test/renderHook'
import { useLogMeal } from './mutations'

const insertSpy = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      insert: (payload: unknown) => {
        insertSpy(table, payload)
        return {
          select: () => ({ single: () => Promise.resolve({ data: { id: 'log1' }, error: null }) }),
          // meal_log_foods insert (no .select()) is awaited directly:
          then: (resolve: (v: unknown) => void) => resolve({ error: null }),
        }
      },
    }),
  },
}))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))

test('useLogMeal inserts a log then its foods with amount_grams populated', async () => {
  const { result } = renderHookWithClient(() => useLogMeal())
  result.current.mutate({
    mealName: 'Lunch',
    foods: [{ name: 'Rice', amount: 150, unit: 'g', calories: 200, protein_g: 4, carbs_g: 44, fat_g: 1 }],
  })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  const foodsCall = insertSpy.mock.calls.find(c => c[0] === 'meal_log_foods')
  expect(foodsCall).toBeTruthy()
  expect(foodsCall![1][0]).toMatchObject({ meal_log_id: 'log1', amount: 150, unit: 'g', amount_grams: 150 })
})
