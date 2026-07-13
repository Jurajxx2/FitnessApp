import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadMealPhoto } from '../lib/storage'
import { useLogMeal, type LogMealResult } from './mutations'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  insertLog: vi.fn(),
  insertFoods: vi.fn(),
  updateLog: vi.fn(),
  deleteLog: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../lib/storage', () => ({ uploadMealPhoto: vi.fn() }))
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
