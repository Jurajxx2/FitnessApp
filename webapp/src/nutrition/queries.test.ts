import { fetchActiveMealPlan, fetchDailyLogs } from './queries'
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

test('fetchDailyLogs bounds the query to the LOCAL calendar day', async () => {
  // Capture the .gte / .lt bounds passed to supabase.
  const bounds: Record<string, string> = {}
  const thenable: any = {
    select: () => thenable,
    eq: () => thenable,
    gte: (_col: string, v: string) => { bounds.gte = v; return thenable },
    lt: (_col: string, v: string) => { bounds.lt = v; return thenable },
    then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
  }
  fromMock.mockReturnValue(thenable)

  await fetchDailyLogs('user-1', '2026-07-12')

  // Expected bounds are LOCAL midnight of the day and of the NEXT day, in UTC ISO.
  // Computed the same way as the implementation so the assertion holds in any
  // timezone (including a DST transition). On a machine whose local time is UTC
  // this coincides with the old UTC-based bounds; off UTC it diverges — which is
  // exactly the bug being fixed.
  const expectedStart = new Date('2026-07-12T00:00:00').toISOString()
  const expectedEndDate = new Date('2026-07-12T00:00:00')
  expectedEndDate.setDate(expectedEndDate.getDate() + 1)
  const expectedEnd = expectedEndDate.toISOString()

  expect(bounds.gte).toBe(expectedStart)
  expect(bounds.lt).toBe(expectedEnd)
  // The lower bound must be parsed as local time, never as a UTC `...Z` literal.
  expect(bounds.gte).not.toBe('2026-07-12T00:00:00Z')
})
