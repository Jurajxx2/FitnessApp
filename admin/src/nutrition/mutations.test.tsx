import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { removeMealPhoto, uploadMealPhoto } from '../lib/storage'
import { useDeleteMealLog, useLogMeal, type LogMealResult } from './mutations'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  insertLog: vi.fn(),
  insertFoods: vi.fn(),
  updateLog: vi.fn(),
  deleteLog: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../lib/storage', () => ({ uploadMealPhoto: vi.fn(), removeMealPhoto: vi.fn() }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }))

function resolvedChain(result: object) {
  const promise = Promise.resolve(result)
  const chain: Record<string, unknown> = {}
  chain.eq = vi.fn(() => chain)
  chain.then = promise.then.bind(promise)
  return chain
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const foods = [{ name: 'Rice', amount: 200, unit: 'g', calories: 240, protein_g: 4, carbs_g: 52, fat_g: 1 }]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.insertLog.mockReturnValue({ select: () => ({ single: () => Promise.resolve({ data: { id: 'log-1' }, error: null }) }) })
  mocks.insertFoods.mockResolvedValue({ error: null })
  mocks.updateLog.mockReturnValue(resolvedChain({ error: null }))
  mocks.deleteLog.mockReturnValue(resolvedChain({ error: null }))
  vi.mocked(removeMealPhoto).mockResolvedValue(undefined)
  mocks.from.mockImplementation((table: string) => {
    if (table === 'meal_logs') return { insert: mocks.insertLog, update: mocks.updateLog, delete: mocks.deleteLog }
    if (table === 'meal_log_foods') return { insert: mocks.insertFoods }
    throw new Error(`Unexpected table ${table}`)
  })
})

describe('useLogMeal photo handling', () => {
  it('uploads the photo after the meal and attaches its public URL', async () => {
    vi.mocked(uploadMealPhoto).mockResolvedValue('https://example.test/meal.jpg')
    const photo = new File(['image'], 'meal.jpg', { type: 'image/jpeg' })
    const hook = renderHook(() => useLogMeal(), { wrapper })
    let saved: LogMealResult | undefined

    await act(async () => {
      saved = await hook.result.current.mutateAsync({ mealName: 'Lunch', foods, photoFile: photo })
    })

    expect(uploadMealPhoto).toHaveBeenCalledWith('user-1', 'log-1', photo)
    expect(mocks.updateLog).toHaveBeenCalledWith({ image_url: 'https://example.test/meal.jpg' })
    expect(saved).toEqual({ id: 'log-1', photoAttached: true, photoError: null })
  })

  it('reports partial success instead of encouraging a duplicate meal retry', async () => {
    vi.mocked(uploadMealPhoto).mockRejectedValue(new Error('storage unavailable'))
    const hook = renderHook(() => useLogMeal(), { wrapper })
    let saved: LogMealResult | undefined

    await act(async () => {
      saved = await hook.result.current.mutateAsync({
        mealName: 'Lunch',
        foods,
        photoFile: new File(['image'], 'meal.jpg', { type: 'image/jpeg' }),
      })
    })

    expect(saved).toEqual({ id: 'log-1', photoAttached: false, photoError: 'storage unavailable' })
    expect(mocks.updateLog).not.toHaveBeenCalled()
  })
})

describe('useDeleteMealLog', () => {
  it('deletes the meal log row scoped to the signed-in user', async () => {
    const hook = renderHook(() => useDeleteMealLog(), { wrapper })

    await act(async () => {
      await hook.result.current.mutateAsync({ logId: 'log-1', imageUrl: null })
    })

    expect(mocks.deleteLog).toHaveBeenCalled()
    const chain = mocks.deleteLog.mock.results[0].value
    expect(chain.eq).toHaveBeenCalledWith('id', 'log-1')
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(removeMealPhoto).not.toHaveBeenCalled()
  })

  it('still succeeds when photo removal fails', async () => {
    vi.mocked(removeMealPhoto).mockRejectedValue(new Error('storage offline'))
    const hook = renderHook(() => useDeleteMealLog(), { wrapper })

    await act(async () => {
      await hook.result.current.mutateAsync({
        logId: 'log-1',
        imageUrl: 'https://example.test/storage/v1/object/public/meal-photos/user-1/meal_log-1.jpg',
      })
    })

    expect(mocks.deleteLog).toHaveBeenCalled()
    expect(removeMealPhoto).toHaveBeenCalled()
  })
})
