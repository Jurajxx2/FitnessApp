import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import LogActivity from './LogActivity'
import { getGeneralActivities, getGeneralActivity, updateGeneralActivity } from '../../activity/api'

// Deliberately does NOT mock '@tanstack/react-query' — this test exercises the real
// QueryClient's prefix-match invalidation logic, which is exactly what the bug (and the
// fix) live in. LogActivity.test.tsx mocks useQuery/useMutation wholesale and so cannot
// see this regression at all: with the mock, `mutate` just calls the captured mutationFn
// closure directly and nothing ever touches a real cache.
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'athlete-1' } }),
}))
vi.mock('../../activity/api', () => ({
  getGeneralActivities: vi.fn(),
  getGeneralActivity: vi.fn(),
  logGeneralActivity: vi.fn(),
  updateGeneralActivity: vi.fn(),
}))

const EXISTING_ACTIVITY = {
  id: 'activity-1',
  user_id: 'athlete-1',
  activity_type: 'CYCLING' as const,
  duration_minutes: 50,
  distance_km: 12.5,
  rpe: 7,
  logged_at: '2026-07-15T08:00:00Z',
  notes: 'Great ride',
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/activity/log?activityId=activity-1']}>
        <Routes>
          <Route path="/activity/log" element={<LogActivity />} />
          <Route path="/activity/history" element={<p>History list</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('LogActivity detail cache invalidation (real QueryClient)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getGeneralActivities).mockResolvedValue([])
    vi.mocked(getGeneralActivity).mockResolvedValue(EXISTING_ACTIVITY)
    vi.mocked(updateGeneralActivity).mockResolvedValue(undefined)
  })

  it('invalidates and refetches the detail query on save, proving the detail key is a prefix match for the save invalidation', async () => {
    // Regression guard for the stale-cache bug: the detail query key must share the
    // ['activity', 'general', userId] prefix with the invalidation the save mutation
    // issues. If the key ever puts 'detail' ahead of userId again (or the invalidation
    // key changes shape), TanStack's positional prefix match stops hitting this query,
    // getGeneralActivity is never called a second time, and this assertion fails.
    const user = userEvent.setup()
    renderPage()

    // Seeds the detail cache via the component's own mount fetch.
    expect(await screen.findByLabelText('Trvanie (minúty)')).toHaveValue(50)
    await waitFor(() => expect(getGeneralActivity).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: 'Uložiť zmeny' }))

    // The mutation's onSuccess awaits invalidateQueries before navigating away, and
    // invalidateQueries awaits the refetch of every active (mounted) matching query by
    // default — so by the time updateGeneralActivity's caller settles, a real prefix
    // match must have already driven a second detail fetch.
    await waitFor(() => expect(updateGeneralActivity).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(getGeneralActivity).toHaveBeenCalledTimes(2))
  })
})
