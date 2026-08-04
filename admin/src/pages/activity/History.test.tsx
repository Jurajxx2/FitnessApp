import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import WorkoutHistory from './History'

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'athlete-1' } }),
}))
vi.mock('../../activity/api', () => ({
  getWorkoutLog: vi.fn(),
  getWorkoutFeedback: vi.fn(),
  getWorkoutHistoryPage: vi.fn(),
}))

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
