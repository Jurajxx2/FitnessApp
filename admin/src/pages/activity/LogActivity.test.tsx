import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import LogActivity from './LogActivity'
import { logGeneralActivity, updateGeneralActivity } from '../../activity/api'
import { toLocalDateTimeInputValue } from '../../activity/logic'

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'athlete-1' } }),
}))
vi.mock('../../activity/api', () => ({
  getGeneralActivities: vi.fn(),
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

function mockActivityList(data: unknown[]) {
  vi.mocked(useQuery).mockReturnValue({ data, isLoading: false, isError: false } as any)
}

// useMutation is mocked wholesale, so `mutate` here invokes the *real* mutationFn closure
// captured from the component's options — the isEditing ternary that decides whether a
// submit calls updateGeneralActivity or logGeneralActivity is the actual regression risk,
// not just something to introspect, so it has to actually run.
function mockMutation() {
  vi.mocked(useMutation).mockImplementation((options: any) => ({
    mutate: (variables: unknown) => { options.mutationFn(variables) },
    isPending: false,
    isError: false,
  } as any))
}

function renderPage(initialEntry: string) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/activity/log" element={<LogActivity />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('LogActivity edit mode (?activityId=)', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => cleanup())

  it('seeds the form from the matching row found in the already-fetched activity list', () => {
    mockActivityList([EXISTING_ACTIVITY])
    mockMutation()

    renderPage('/activity/log?activityId=activity-1')

    expect(screen.getByText('Upraviť aktivitu')).toBeInTheDocument()
    expect(screen.getByLabelText('Trvanie (minúty)')).toHaveValue(50)
    expect(screen.getByLabelText('Vzdialenosť (km, voliteľné)')).toHaveValue(12.5)
    expect(screen.getByLabelText('Náročnosť / RPE (voliteľné)')).toHaveValue(7)
    expect(screen.getByLabelText('Poznámka (voliteľné)')).toHaveValue('Great ride')
    // Computed the same way the component seeds it, so this is timezone-independent —
    // a hardcoded 'YYYY-MM-DDTHH:mm' string would break on a machine in another TZ.
    expect(screen.getByLabelText('Dátum a čas')).toHaveValue(toLocalDateTimeInputValue(new Date(EXISTING_ACTIVITY.logged_at)))
  })

  it('submitting calls updateGeneralActivity with the seeded draft, not logGeneralActivity', () => {
    mockActivityList([EXISTING_ACTIVITY])
    mockMutation()

    renderPage('/activity/log?activityId=activity-1')

    fireEvent.click(screen.getByRole('button', { name: 'Uložiť zmeny' }))

    // Round-tripped through the same toLocalDateTimeInputValue -> Date -> toISOString chain
    // the component uses internally, so this holds regardless of the test runner's TZ.
    const expectedIso = new Date(toLocalDateTimeInputValue(new Date(EXISTING_ACTIVITY.logged_at))).toISOString()
    expect(updateGeneralActivity).toHaveBeenCalledWith('athlete-1', 'activity-1', {
      activity_type: 'CYCLING',
      duration_minutes: 50,
      distance_km: 12.5,
      rpe: 7,
      logged_at: expectedIso,
      notes: 'Great ride',
    })
    expect(logGeneralActivity).not.toHaveBeenCalled()
  })

  it('shows a not-found state instead of the form when the id has no matching row', () => {
    mockActivityList([])
    mockMutation()

    renderPage('/activity/log?activityId=missing-activity')

    expect(screen.getByText('Aktivita sa nenašla.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Trvanie (minúty)')).not.toBeInTheDocument()
  })
})

describe('LogActivity create mode (no ?activityId=) stays unchanged', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => cleanup())

  it('still calls logGeneralActivity with the default draft, never updateGeneralActivity', () => {
    mockActivityList([])
    mockMutation()

    renderPage('/activity/log')

    expect(screen.getByText('Zapísať ďalšiu aktivitu')).toBeInTheDocument()
    const dateInput = screen.getByLabelText('Dátum a čas') as HTMLInputElement
    const expectedIso = new Date(dateInput.value).toISOString()

    fireEvent.click(screen.getByRole('button', { name: 'Uložiť aktivitu' }))

    expect(logGeneralActivity).toHaveBeenCalledWith('athlete-1', {
      activity_type: 'WALKING',
      duration_minutes: 30,
      distance_km: null,
      rpe: null,
      logged_at: expectedIso,
      notes: null,
    })
    expect(updateGeneralActivity).not.toHaveBeenCalled()
  })

  it('does not seed from the general-activity list when there is no id to look up', () => {
    mockActivityList([EXISTING_ACTIVITY])
    mockMutation()

    renderPage('/activity/log')

    // The general-activity list (used for the "recent activities" panel) has a row in it,
    // but with no ?activityId= the seeding effect must stay a no-op: create-path defaults,
    // not EXISTING_ACTIVITY's values, must be what's on screen.
    expect(screen.getByLabelText('Trvanie (minúty)')).toHaveValue(30)
    expect(screen.getByLabelText('Poznámka (voliteľné)')).toHaveValue('')
  })
})
