import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import WorkoutSession from './Session'

// vi.mock factories are hoisted above imports/consts, so mock data referenced
// inside them must live in a vi.hoisted() block rather than a plain top-level const.
const { ACTIVE_LOG, WORKOUT_ROW, saveSet } = vi.hoisted(() => {
  function makeSetLog(overrides: Record<string, unknown>) {
    return {
      id: 'set-1',
      exercise_log_id: 'ex-log-1',
      sort_order: 1,
      target_reps: null,
      actual_reps: null,
      target_weight_kg: null,
      actual_weight_kg: null,
      rpe: null,
      target_rest_seconds: 60,
      actual_rest_seconds: null,
      actual_duration_seconds: null,
      completed: false,
      ...overrides,
    }
  }

  // Plank's plan `log_type` is authoritative ('time'), but its reps text ("60") is
  // deliberately NOT time-like — proving detection keys off log_type, not the old
  // free-text heuristic (which would have looked for "sec"/"min"/"hold"/"time").
  const TIMED_PLAN_ROW = {
    id: 'we-1',
    workout_id: 'workout-1',
    exercise_id: 'ex-1',
    name: 'Plank',
    muscle_group: null,
    sets: 1,
    reps: '60',
    log_type: 'time' as const,
    target_duration_seconds: 45,
    rest_seconds: 60,
    tips: null,
    sort_order: 1,
  }

  // Bench Press's plan `log_type` is 'weight_reps', but its reps text ("30 sec hold")
  // IS time-like — the old heuristic would have rendered timed UI here. Authoritative
  // detection must NOT render timed UI since a plan with a non-'time' log_type exists.
  const WEIGHT_REPS_PLAN_ROW = {
    id: 'we-2',
    workout_id: 'workout-1',
    exercise_id: 'ex-2',
    name: 'Bench Press',
    muscle_group: null,
    sets: 1,
    reps: '30 sec hold',
    log_type: 'weight_reps' as const,
    target_duration_seconds: null,
    rest_seconds: 90,
    tips: null,
    sort_order: 2,
  }

  const WORKOUT_ROW = {
    id: 'workout-1',
    user_id: null,
    owner_user_id: null,
    name: 'Test Workout',
    day_of_week: null,
    duration_minutes: 30,
    notes: null,
    is_active: true,
    source: 'coach' as const,
    workout_exercises: [TIMED_PLAN_ROW, WEIGHT_REPS_PLAN_ROW],
  }

  const ACTIVE_LOG = {
    id: 'log-1',
    user_id: 'athlete-1',
    workout_id: 'workout-1',
    workout_name: 'Test Workout',
    duration_minutes: 0,
    notes: null,
    status: 'in_progress' as const,
    logged_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    exercise_logs: [
      {
        id: 'ex-log-1',
        workout_log_id: 'log-1',
        exercise_id: 'ex-1',
        exercise_name: 'Plank',
        notes: null,
        sets_completed: null,
        reps_completed: null,
        weight_kg: null,
        set_logs: [makeSetLog({ id: 'set-1', exercise_log_id: 'ex-log-1' })],
      },
      {
        id: 'ex-log-2',
        workout_log_id: 'log-1',
        exercise_id: 'ex-2',
        exercise_name: 'Bench Press',
        notes: null,
        sets_completed: null,
        reps_completed: null,
        weight_kg: null,
        // Distinct sort_order from Plank's set so label queries ("Séria N …") in
        // tests unambiguously target one exercise's row.
        set_logs: [makeSetLog({ id: 'set-2', exercise_log_id: 'ex-log-2', sort_order: 2, target_rest_seconds: 90 })],
      },
    ],
  }

  return { ACTIVE_LOG, WORKOUT_ROW, saveSet: vi.fn().mockResolvedValue(undefined) }
})

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'athlete-1' } }),
}))

vi.mock('../../activity/api', () => ({
  getActiveWorkout: vi.fn().mockResolvedValue(ACTIVE_LOG),
  getLastExercisePerformances: vi.fn().mockResolvedValue({
    'ex-1': { logged_at: '2026-07-20T10:00:00Z', actual_reps: null, actual_weight_kg: null, actual_duration_seconds: 42, rpe: 7 },
    'ex-2': { logged_at: '2026-07-20T10:00:00Z', actual_reps: 8, actual_weight_kg: 80, actual_duration_seconds: null, rpe: 8 },
  }),
  getWorkout: vi.fn().mockResolvedValue(WORKOUT_ROW),
  saveSet: (...args: unknown[]) => saveSet(...args),
  addSet: vi.fn(),
  removeSet: vi.fn(),
  finishWorkout: vi.fn(),
  discardWorkout: vi.fn(),
}))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/activity/session']}>
        <WorkoutSession />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('WorkoutSession authoritative timed detection', () => {
  beforeEach(() => {
    saveSet.mockClear()
  })

  it('renders the duration/stopwatch UI for a log_type "time" exercise even when its reps text is not time-like', async () => {
    renderPage()

    // findBy* retries until the plan (workoutQuery) has loaded and the second
    // render — the one carrying the authoritative log_type — has landed.
    expect(await screen.findByLabelText('Séria 1 trvanie v sekundách')).toBeInTheDocument()
    expect(screen.getByLabelText('Spustiť časovač série 1')).toBeInTheDocument()
    expect(screen.queryByLabelText('Séria 1 opakovania')).not.toBeInTheDocument()
  })

  it('does not render timed UI for a weight_reps exercise even when its reps text looks time-ish', async () => {
    renderPage()

    expect(await screen.findByLabelText('Séria 2 opakovania')).toBeInTheDocument()
    expect(screen.getByLabelText('Séria 2 váha v kilogramoch')).toBeInTheDocument()
    expect(screen.queryByLabelText('Séria 2 trvanie v sekundách')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Spustiť časovač série 2')).not.toBeInTheDocument()
  })

  it('labels the target and last performance clearly and renders only one timed RPE column', async () => {
    renderPage()

    expect(await screen.findByText('0/1 sérií dokončených · Cieľ: 45 s na sériu')).toBeInTheDocument()
    expect(await screen.findByText('Posledný výkon: 42 s · RPE 7')).toBeInTheDocument()
    expect(screen.getAllByText('RPE')).toHaveLength(2)
    expect(screen.getByLabelText('Séria 1 RPE')).toHaveAttribute('placeholder', '7')
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })
})

describe('WorkoutSession live stopwatch', () => {
  beforeEach(() => {
    saveSet.mockClear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts up while running and freezes when paused', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage()

    const durationInput = (await screen.findByLabelText('Séria 1 trvanie v sekundách')) as HTMLInputElement
    expect(durationInput.value).toBe('')

    await user.click(screen.getByLabelText('Spustiť časovač série 1'))

    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    const valueAfterRunning = Number(durationInput.value)
    expect(valueAfterRunning).toBeGreaterThanOrEqual(3)

    await user.click(screen.getByLabelText('Zastaviť časovač série 1'))
    const valueAfterPause = durationInput.value

    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(durationInput.value).toBe(valueAfterPause)
  })

  it('saves the accumulated duration through the existing actual_duration_seconds payload path', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage()

    await screen.findByLabelText('Séria 1 trvanie v sekundách')
    await user.click(screen.getByLabelText('Spustiť časovač série 1'))
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    await user.click(screen.getByLabelText('Zastaviť časovač série 1'))
    await user.click(screen.getByLabelText('Dokončiť sériu 1'))
    // The save click kicks off a query invalidation/refetch outside userEvent's
    // own act scope; flush it before asserting so React doesn't warn.
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    expect(saveSet).toHaveBeenCalledWith(
      'set-1',
      expect.objectContaining({ actual_duration_seconds: expect.any(Number), completed: true })
    )
    const [, payload] = saveSet.mock.calls[0]
    expect(payload.actual_duration_seconds).toBeGreaterThanOrEqual(3)
  })
})
