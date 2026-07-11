import { fetchActiveMealPlan } from './queries'
import { makeQueryResult } from '../test/supabaseMock'

const rpcMock = vi.fn()
const fromMock = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

afterEach(() => vi.clearAllMocks())

test('resolves the current plan id before loading that exact meal plan', async () => {
  rpcMock.mockResolvedValue({ data: [{ meal_plan_id: 'plan-current' }], error: null })
  fromMock.mockReturnValue(makeQueryResult({
    data: { id: 'plan-current', name: 'Current plan', meals: [] },
    error: null,
  }))

  const result = await fetchActiveMealPlan('user-1')

  expect(rpcMock).toHaveBeenCalledWith('get_current_meal_plan_id', { p_user_id: 'user-1' })
  expect(fromMock).toHaveBeenCalledWith('meal_plans')
  expect(result?.id).toBe('plan-current')
})

test('returns null without querying meal plans when no current assignment exists', async () => {
  rpcMock.mockResolvedValue({ data: [], error: null })

  await expect(fetchActiveMealPlan('user-1')).resolves.toBeNull()
  expect(fromMock).not.toHaveBeenCalled()
})
