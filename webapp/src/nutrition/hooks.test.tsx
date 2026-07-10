import { waitFor } from '@testing-library/react'
import { renderHookWithClient } from '../test/renderHook'
import { makeQueryResult } from '../test/supabaseMock'
import { useRecipes, useDailySummary } from './hooks'

const fromMock = vi.fn()
vi.mock('../lib/supabase', () => ({ supabase: { from: (...a: unknown[]) => fromMock(...a) } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, profile: null }) }))

test('useRecipes returns rows from supabase', async () => {
  fromMock.mockReturnValue(makeQueryResult({ data: [{ id: 'r1', name: 'Oats' }], error: null }))
  const { result } = renderHookWithClient(() => useRecipes())
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data).toEqual([{ id: 'r1', name: 'Oats' }])
})

test('useDailySummary sums the day\'s logged foods', async () => {
  fromMock.mockReturnValue(makeQueryResult({
    data: [{ id: 'l1', meal_log_foods: [
      { calories: 100, protein_g: 10, carbs_g: 5, fat_g: 2 },
      { calories: 200, protein_g: 5, carbs_g: 20, fat_g: 8 },
    ] }],
    error: null,
  }))
  const { result } = renderHookWithClient(() => useDailySummary('2026-07-10'))
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.data.calories).toBe(300)
  expect(result.current.data.protein_g).toBe(15)
})
