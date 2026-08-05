import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { useMutation, useQuery, keepPreviousData } from '@tanstack/react-query'
import WorkoutHistory from './History'

const { MOCK_KEEP_PREVIOUS_DATA } = vi.hoisted(() => ({ MOCK_KEEP_PREVIOUS_DATA: Symbol('keepPreviousData') }))

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  keepPreviousData: MOCK_KEEP_PREVIOUS_DATA,
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'athlete-1' } }),
}))
vi.mock('../../activity/api', () => ({
  getWorkoutLog: vi.fn(),
  getWorkoutFeedback: vi.fn(),
  getWorkoutHistoryPage: vi.fn(),
  getGeneralActivities: vi.fn(),
  deleteWorkoutLog: vi.fn(),
  updateWorkoutLog: vi.fn(),
  deleteGeneralActivity: vi.fn(),
  updateGeneralActivity: vi.fn(),
}))

// useMutation is mocked wholesale (no real TanStack QueryClient in these tests). A page
// re-renders its useMutation hooks on every state change (e.g. opening a dialog), so a
// naive per-call spy would go stale — the button's onClick closes over whichever render's
// spy was current when it last rendered, not the first one seen. Instead, key a stable spy
// per mutation "slot" by its mutationFn arity (deleteWorkoutLog takes no args, updateWorkoutLog
// takes the edited values object) so every render of the same mutation shares one spy,
// mirroring how the real useMutation keeps a stable `mutate` reference across re-renders.
function mockMutations() {
  const bySignature = new Map<number, { options: { mutationFn: (...args: unknown[]) => unknown }; mutate: ReturnType<typeof vi.fn> }>()
  vi.mocked(useMutation).mockImplementation((options: any) => {
    const arity = options.mutationFn.length
    let entry = bySignature.get(arity)
    if (!entry) {
      entry = { options, mutate: vi.fn() }
      bySignature.set(arity, entry)
    } else {
      entry.options = options
    }
    return { mutate: entry.mutate, isPending: false, isError: false } as any
  })
  return { find: (arity: number) => bySignature.get(arity) }
}

// Every page under test here mounts at least one useMutation call unconditionally, so give
// it a harmless default before each test. Tests that care which mutation fired (delete vs.
// edit) override this via mockMutations() to capture per-call spies instead.
beforeEach(() => {
  vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false } as any)
})

const LOG = {
  id: 'log-1',
  user_id: 'athlete-1',
  workout_id: 'w-1',
  workout_name: 'Push Day',
  duration_minutes: 45,
  notes: null,
  status: 'completed',
  logged_at: '2026-07-20T10:00:00Z',
  created_at: '2026-07-20T10:00:00Z',
  exercise_logs: [
    {
      id: 'ex-log-1',
      workout_log_id: 'log-1',
      exercise_id: 'e1',
      exercise_name: 'Bench Press',
      notes: null,
      sets_completed: null,
      reps_completed: null,
      weight_kg: null,
      set_logs: [
        { id: 's1', exercise_log_id: 'ex-log-1', sort_order: 1, target_reps: 10, actual_reps: 10, target_weight_kg: 60, actual_weight_kg: 60, rpe: 7, target_rest_seconds: 60, actual_rest_seconds: 60, actual_duration_seconds: null, completed: true },
      ],
    },
    {
      id: 'ex-log-2',
      workout_log_id: 'log-1',
      exercise_id: 'e2',
      exercise_name: 'Overhead Press',
      notes: null,
      sets_completed: null,
      reps_completed: null,
      weight_kg: null,
      set_logs: [
        { id: 's2', exercise_log_id: 'ex-log-2', sort_order: 1, target_reps: 10, actual_reps: 8, target_weight_kg: 40, actual_weight_kg: 40, rpe: 8, target_rest_seconds: 60, actual_rest_seconds: 60, actual_duration_seconds: null, completed: true },
      ],
    },
  ],
}

// Both HistoryDetail queries share the mocked useQuery hook; branch on the queryKey's
// second segment so the log query and the feedback query each get their own canned data.
function mockQueries(feedback: unknown[]) {
  vi.mocked(useQuery).mockImplementation((options: any) => {
    if (options.queryKey[1] === 'workout-feedback') return { data: feedback, isLoading: false, isError: false } as any
    return { data: LOG, isLoading: false, isError: false } as any
  })
}

function renderDetail() {
  render(
    <MemoryRouter initialEntries={['/activity/history/log-1']}>
      <Routes>
        <Route path="/activity/history/:logId" element={<WorkoutHistory />} />
      </Routes>
    </MemoryRouter>
  )
}

const ACTIVITY = {
  id: 'activity-1',
  user_id: 'athlete-1',
  activity_type: 'RUNNING' as const,
  duration_minutes: 35,
  distance_km: 5,
  rpe: 6,
  logged_at: '2026-07-18T07:00:00Z',
  notes: null,
}

// HistoryList's own two queries (paginated workout history, general activities) share the
// mocked useQuery hook; branch on the queryKey's second segment the same way mockQueries does.
function mockListQueries(history: unknown[], activities: unknown[]) {
  vi.mocked(useQuery).mockImplementation((options: any) => {
    if (options.queryKey[1] === 'general') return { data: activities, isLoading: false, isError: false } as any
    return { data: { data: history, count: history.length }, isLoading: false, isError: false } as any
  })
}

function renderList() {
  render(
    <MemoryRouter initialEntries={['/activity/history']}>
      <Routes>
        <Route path="/activity/history" element={<WorkoutHistory />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('HistoryDetail coach feedback', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => cleanup())

  it('shows session-level feedback under its label and per-exercise feedback inside the matching exercise section', () => {
    mockQueries([
      {
        id: 'f-session', user_id: 'athlete-1', coach_id: 'coach-1',
        workout_log_id: 'log-1', exercise_log_id: null,
        body: 'Great session overall!', created_at: '2026-07-20T11:00:00Z', updated_at: '2026-07-20T11:00:00Z',
      },
      {
        id: 'f-exercise', user_id: 'athlete-1', coach_id: 'coach-1',
        workout_log_id: null, exercise_log_id: 'ex-log-2',
        body: 'Watch your elbow flare.', created_at: '2026-07-20T11:05:00Z', updated_at: '2026-07-20T11:05:00Z',
      },
    ])

    renderDetail()

    expect(screen.getByText('Spätná väzba od trénera')).toBeInTheDocument()
    expect(screen.getByText('Great session overall!')).toBeInTheDocument()
    expect(screen.getByText('Poznámka trénera')).toBeInTheDocument()
    expect(screen.getByText('Watch your elbow flare.')).toBeInTheDocument()

    // The exercise-level note belongs to Overhead Press's exercise_log_id, so it must
    // render inside that section and nowhere near the unrelated Bench Press section.
    const overheadSection = screen.getByText('Overhead Press').closest('section')!
    expect(within(overheadSection).getByText('Watch your elbow flare.')).toBeInTheDocument()
    const benchSection = screen.getByText('Bench Press').closest('section')!
    expect(within(benchSection).queryByText('Watch your elbow flare.')).not.toBeInTheDocument()
    expect(within(benchSection).queryByText('Poznámka trénera')).not.toBeInTheDocument()
  })

  it('renders no extra feedback UI when there is no feedback at all', () => {
    mockQueries([])

    renderDetail()

    expect(screen.getByText('Push Day')).toBeInTheDocument()
    expect(screen.queryByText('Spätná väzba od trénera')).not.toBeInTheDocument()
    expect(screen.queryByText('Poznámka trénera')).not.toBeInTheDocument()
  })
})

describe('HistoryDetail delete', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => cleanup())

  it('gates the delete mutation behind the confirm dialog — opening it must not fire the mutation', () => {
    const calls = mockMutations()
    mockQueries([])

    renderDetail()

    // Not shown until the trigger is clicked.
    expect(screen.queryByText('Vymazať tréning?')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Vymazať/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Vymazať tréning?')).toBeInTheDocument()
    expect(within(dialog).getByText('Tento tréningový záznam sa natrvalo odstráni z histórie aj zo štatistík.')).toBeInTheDocument()

    const deleteCall = calls.find(0)
    expect(deleteCall).toBeDefined()
    expect(deleteCall!.mutate).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Vymazať' }))

    expect(deleteCall!.mutate).toHaveBeenCalledTimes(1)
  })
})

describe('HistoryDetail edit', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => cleanup())

  it('submits the changed logged_at (and the existing notes) through the update mutation', () => {
    const calls = mockMutations()
    mockQueries([])

    renderDetail()

    fireEvent.click(screen.getByRole('button', { name: /Upraviť/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Upraviť tréning')).toBeInTheDocument()

    const dateInput = within(dialog).getByLabelText('Dátum a čas')
    fireEvent.change(dateInput, { target: { value: '2026-07-21T09:30' } })

    const updateCall = calls.find(1)
    expect(updateCall).toBeDefined()
    expect(updateCall!.mutate).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Uložiť' }))

    // Converted through the same Date(...).toISOString() the component uses, so this is
    // timezone-independent regardless of what TZ the test runner executes under.
    const expectedIso = new Date('2026-07-21T09:30').toISOString()
    expect(updateCall!.mutate).toHaveBeenCalledWith({ logged_at: expectedIso, notes: null })
  })
})

describe('HistoryList general-activity delete', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => cleanup())

  it('gates the delete behind a confirm dialog and deletes the correct row', () => {
    const calls = mockMutations()
    mockListQueries([], [ACTIVITY])

    renderList()

    expect(screen.queryByText('Vymazať aktivitu?')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Vymazať/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Vymazať aktivitu?')).toBeInTheDocument()
    expect(within(dialog).getByText('Táto aktivita sa natrvalo odstráni z histórie.')).toBeInTheDocument()

    const deleteCall = calls.find(1)
    expect(deleteCall).toBeDefined()
    expect(deleteCall!.mutate).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Vymazať' }))

    expect(deleteCall!.mutate).toHaveBeenCalledWith('activity-1')
  })
})

describe('HistoryList loading chrome', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => cleanup())

  it('passes placeholderData: keepPreviousData on the paginated workout-history query', () => {
    const capturedOptions: Array<{ queryKey: unknown[]; placeholderData?: unknown }> = []
    vi.mocked(useQuery).mockImplementation((options: any) => {
      if (options.queryKey[1] === 'general') return { data: [], isLoading: false, isError: false } as any
      capturedOptions.push(options)
      return { data: { data: [], count: 0 }, isLoading: false, isError: false } as any
    })

    renderList()

    expect(capturedOptions).toHaveLength(1)
    expect(capturedOptions[0]).toMatchObject({ placeholderData: keepPreviousData })
  })

  it('keeps the page header and the general-activities section mounted while the workout-history query is loading', () => {
    // Regression test for the unmount bug: an early `if (historyQuery.isLoading) return ...`
    // used to hide the PageIntro header *and* the "Ostatné aktivity" section (which is driven
    // by the separate, already-resolved activitiesQuery) whenever the paginated workout
    // history query re-keyed on a page change. Both must stay mounted through a loading state.
    vi.mocked(useQuery).mockImplementation((options: any) => {
      if (options.queryKey[1] === 'general') return { data: [ACTIVITY], isLoading: false, isError: false } as any
      return { data: undefined, isLoading: true, isFetching: true, isError: false } as any
    })

    renderList()

    expect(screen.getByText('História tréningov')).toBeInTheDocument()
    expect(screen.getByText('Ostatné aktivity')).toBeInTheDocument()
  })
})
