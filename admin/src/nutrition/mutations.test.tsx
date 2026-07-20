import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { removeMealPhoto, uploadMealPhoto } from '../lib/storage'
import {
  useDeleteMealLog,
  useLogMeal,
  useSaveFoodFavorite,
  useSaveMealTemplate,
  useUpdateMealLog,
  type LogMealResult,
} from './mutations'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  updateLog: vi.fn(),
  deleteLog: vi.fn(),
  upsertFavorite: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }))
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
const input = {
  mealName: 'Obed', mealType: 'lunch' as const, loggedAt: '2026-07-20T11:30:00.000Z', foods,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.rpc.mockResolvedValue({ data: 'log-1', error: null })
  mocks.updateLog.mockReturnValue(resolvedChain({ error: null }))
  mocks.deleteLog.mockReturnValue(resolvedChain({ error: null }))
  mocks.upsertFavorite.mockResolvedValue({ error: null })
  mocks.from.mockImplementation((table: string) => {
    if (table === 'meal_logs') return { update: mocks.updateLog, delete: mocks.deleteLog }
    if (table === 'food_favorites') return { upsert: mocks.upsertFavorite }
    throw new Error(`Unexpected table ${table}`)
  })
  vi.mocked(removeMealPhoto).mockResolvedValue(undefined)
})

describe('useLogMeal atomic persistence', () => {
  it('saves parent metadata and item snapshots through one RPC', async () => {
    const hook = renderHook(() => useLogMeal(), { wrapper })
    await act(async () => { await hook.result.current.mutateAsync(input) })

    expect(mocks.rpc).toHaveBeenCalledWith('save_meal_log', {
      p_meal_log_id: null,
      p_meal_name: 'Obed',
      p_meal_type: 'lunch',
      p_logged_at: '2026-07-20T11:30:00.000Z',
      p_notes: null,
      p_items: [{
        name: 'Rice', amount: 200, unit: 'g', amount_grams: 200,
        calories: 240, protein_g: 4, carbs_g: 52, fat_g: 1,
      }],
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('does not populate amount_grams for non-gram units', async () => {
    const hook = renderHook(() => useLogMeal(), { wrapper })
    await act(async () => {
      await hook.result.current.mutateAsync({
        ...input,
        foods: [{ ...foods[0], amount: 2, unit: 'ks' }],
      })
    })
    expect(mocks.rpc).toHaveBeenCalledWith('save_meal_log', expect.objectContaining({
      p_items: [expect.objectContaining({ amount: 2, unit: 'ks', amount_grams: null })],
    }))
  })

  it('surfaces an RPC failure before attempting photo upload', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('invalid item') })
    const hook = renderHook(() => useLogMeal(), { wrapper })
    await expect(act(async () => hook.result.current.mutateAsync({
      ...input, photoFile: new File(['image'], 'meal.jpg', { type: 'image/jpeg' }),
    }))).rejects.toThrow('invalid item')
    expect(uploadMealPhoto).not.toHaveBeenCalled()
  })
})

describe('useLogMeal photo handling', () => {
  it('uploads the photo after the meal transaction and attaches its object path', async () => {
    vi.mocked(uploadMealPhoto).mockResolvedValue('user-1/meal_log-1.jpg')
    const photo = new File(['image'], 'meal.jpg', { type: 'image/jpeg' })
    const hook = renderHook(() => useLogMeal(), { wrapper })
    let saved: LogMealResult | undefined

    await act(async () => { saved = await hook.result.current.mutateAsync({ ...input, photoFile: photo }) })

    expect(uploadMealPhoto).toHaveBeenCalledWith('user-1', 'log-1', photo, { upsert: true })
    expect(mocks.updateLog).toHaveBeenCalledWith({ image_url: 'user-1/meal_log-1.jpg' })
    expect(saved).toEqual({ id: 'log-1', photoAttached: true, photoError: null })
  })

  it('reports partial success instead of encouraging a duplicate meal retry', async () => {
    vi.mocked(uploadMealPhoto).mockRejectedValue(new Error('storage unavailable'))
    const hook = renderHook(() => useLogMeal(), { wrapper })
    let saved: LogMealResult | undefined
    await act(async () => {
      saved = await hook.result.current.mutateAsync({
        ...input, photoFile: new File(['image'], 'meal.jpg', { type: 'image/jpeg' }),
      })
    })
    expect(saved).toEqual({ id: 'log-1', photoAttached: false, photoError: 'storage unavailable' })
    expect(mocks.updateLog).not.toHaveBeenCalled()
  })
})

describe('useUpdateMealLog photo replacement', () => {
  it('does not delete a replacement uploaded over the existing deterministic path', async () => {
    vi.mocked(uploadMealPhoto).mockResolvedValue('user-1/meal_log-1.jpg')
    const photo = new File(['new-image'], 'replacement.jpg', { type: 'image/jpeg' })
    const hook = renderHook(() => useUpdateMealLog(), { wrapper })

    await act(async () => {
      await hook.result.current.mutateAsync({
        ...input,
        logId: 'log-1',
        photoFile: photo,
        existingImageUrl: 'user-1/meal_log-1.jpg',
      })
    })

    expect(uploadMealPhoto).toHaveBeenCalledWith('user-1', 'log-1', photo, { upsert: true })
    expect(removeMealPhoto).not.toHaveBeenCalled()
  })
})

describe('useDeleteMealLog', () => {
  it('deletes the meal log row scoped to the signed-in user', async () => {
    const hook = renderHook(() => useDeleteMealLog(), { wrapper })
    await act(async () => { await hook.result.current.mutateAsync({ logId: 'log-1', imageUrl: null }) })
    const chain = mocks.deleteLog.mock.results[0].value
    expect(chain.eq).toHaveBeenCalledWith('id', 'log-1')
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(removeMealPhoto).not.toHaveBeenCalled()
  })

  it('still succeeds when photo removal fails', async () => {
    vi.mocked(removeMealPhoto).mockRejectedValue(new Error('storage offline'))
    const hook = renderHook(() => useDeleteMealLog(), { wrapper })
    await act(async () => {
      await hook.result.current.mutateAsync({ logId: 'log-1', imageUrl: 'user-1/meal_log-1.jpg' })
    })
    expect(mocks.deleteLog).toHaveBeenCalled()
    expect(removeMealPhoto).toHaveBeenCalledWith('user-1/meal_log-1.jpg')
  })
})

describe('reusable meal snapshots', () => {
  it('upserts a personal favorite with a normalized gram snapshot', async () => {
    const hook = renderHook(() => useSaveFoodFavorite(), { wrapper })
    await act(async () => { await hook.result.current.mutateAsync(foods[0]) })
    expect(mocks.upsertFavorite).toHaveBeenCalledWith({
      user_id: 'user-1', name: 'Rice', amount: 200, unit: 'g', amount_grams: 200,
      calories: 240, protein_g: 4, carbs_g: 52, fat_g: 1,
    }, { onConflict: 'user_id,name' })
  })

  it('saves a multi-item meal through one transactional RPC', async () => {
    mocks.rpc.mockResolvedValue({ data: 'saved-1', error: null })
    const hook = renderHook(() => useSaveMealTemplate(), { wrapper })
    await act(async () => { await hook.result.current.mutateAsync({ name: 'Môj obed', foods }) })
    expect(mocks.rpc).toHaveBeenCalledWith('save_saved_meal', {
      p_name: 'Môj obed',
      p_items: [{
        name: 'Rice', amount: 200, unit: 'g', amount_grams: 200,
        calories: 240, protein_g: 4, carbs_g: 52, fat_g: 1,
      }],
    })
  })
})
