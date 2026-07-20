import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchRecentFoods, fetchSavedMeals, fetchSeedFoods } from './queries'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: vi.fn() } }))

function queryChain(result: object) {
  const promise = Promise.resolve(result)
  const chain: Record<string, ReturnType<typeof vi.fn> | typeof promise.then> = {
    select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), then: promise.then.bind(promise),
  }
  for (const method of ['select', 'eq', 'order', 'limit'] as const) {
    ;(chain[method] as ReturnType<typeof vi.fn>).mockReturnValue(chain)
  }
  return chain
}

beforeEach(() => vi.clearAllMocks())

describe('nutrition quick-add queries', () => {
  it('loads a fixed, verified seed catalogue instead of an unbounded search result', async () => {
    const chain = queryChain({ data: [], error: null })
    mocks.from.mockReturnValue(chain)
    await fetchSeedFoods()
    expect(mocks.from).toHaveBeenCalledWith('foods')
    expect(chain.eq).toHaveBeenCalledWith('is_verified', true)
    expect(chain.order).toHaveBeenCalledWith('name', { ascending: true })
    expect(chain.limit).toHaveBeenCalledWith(20)
  })

  it('bounds source history and keeps the newest normalized recent snapshot', async () => {
    const chain = queryChain({
      data: [
        {
          id: 'new', user_id: 'user-1', meal_name: 'Obed', meal_type: 'lunch', notes: null,
          image_url: null, logged_at: '2026-07-20T12:00:00Z',
          meal_log_foods: [{
            id: 'new-food', meal_log_id: 'new', name: 'Ryža', amount: 250, unit: 'g', amount_grams: 250,
            calories: 300, protein_g: 5, carbs_g: 60, fat_g: 1,
          }],
        },
        {
          id: 'old', user_id: 'user-1', meal_name: 'Obed', meal_type: 'lunch', notes: null,
          image_url: null, logged_at: '2026-07-19T12:00:00Z',
          meal_log_foods: [{
            id: 'old-food', meal_log_id: 'old', name: ' ryža ', amount: 100, unit: 'G', amount_grams: 100,
            calories: 120, protein_g: 2, carbs_g: 25, fat_g: 0,
          }],
        },
      ],
      error: null,
    })
    mocks.from.mockReturnValue(chain)
    const result = await fetchRecentFoods('user-1', 100)
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(chain.limit).toHaveBeenCalledWith(30)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ amount: 250, source: 'recent' })
  })

  it('sorts nested saved items by their explicit order', async () => {
    const chain = queryChain({
      data: [{
        id: 'saved-1', user_id: 'user-1', name: 'Raňajky',
        created_at: '2026-07-20T10:00:00Z', updated_at: '2026-07-20T10:00:00Z',
        saved_meal_items: [
          { id: 'b', saved_meal_id: 'saved-1', name: 'B', amount: null, unit: null, amount_grams: null, calories: 1, protein_g: 1, carbs_g: 1, fat_g: 1, sort_order: 2, created_at: '2026-07-20T10:00:00Z' },
          { id: 'a', saved_meal_id: 'saved-1', name: 'A', amount: null, unit: null, amount_grams: null, calories: 1, protein_g: 1, carbs_g: 1, fat_g: 1, sort_order: 0, created_at: '2026-07-20T10:00:00Z' },
        ],
      }],
      error: null,
    })
    mocks.from.mockReturnValue(chain)
    const [saved] = await fetchSavedMeals('user-1')
    expect(saved.saved_meal_items.map(item => item.id)).toEqual(['a', 'b'])
  })
})
