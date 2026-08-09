import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import WorkoutSession from './Session'

// vi.mock factories are hoisted above imports/consts, so mock data referenced
// inside them must live in a vi.hoisted() block rather than a plain top-level const.
// getActiveWorkout/getWorkout/discardWorkout/removeSet are hoisted too (not just
// baked into the factory) so individual tests can override their resolved value
// or assert on their call history, the same way `saveSet` already is below.
const { ACTIVE_LOG, WORKOUT_ROW, saveSet, getActiveWorkout, getWorkout, discardWorkout, removeSet, finishWorkout } = vi.hoisted(() => {
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

  return {
    ACTIVE_LOG,
    WORKOUT_ROW,
    saveSet: vi.fn().mockResolvedValue(undefined),
    getActiveWorkout: vi.fn().mockResolvedValue(ACTIVE_LOG),
    getWorkout: vi.fn().mockResolvedValue(WORKOUT_ROW),
    discardWorkout: vi.fn().mockResolvedValue(undefined),
    removeSet: vi.fn().mockResolvedValue(undefined),
    finishWorkout: vi.fn().mockResolvedValue(30),
  }
})

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'athlete-1' } }),
}))

vi.mock('../../activity/api', () => ({
  getActiveWorkout: (...args: unknown[]) => getActiveWorkout(...args),
  getLastExercisePerformances: vi.fn().mockResolvedValue({
    'ex-1': { logged_at: '2026-07-20T10:00:00Z', actual_reps: null, actual_weight_kg: null, actual_duration_seconds: 42, rpe: 7 },
    'ex-2': { logged_at: '2026-07-20T10:00:00Z', actual_reps: 8, actual_weight_kg: 80, actual_duration_seconds: null, rpe: 8 },
  }),
  getWorkout: (...args: unknown[]) => getWorkout(...args),
  saveSet: (...args: unknown[]) => saveSet(...args),
  addSet: vi.fn(),
  removeSet: (...args: unknown[]) => removeSet(...args),
  finishWorkout: (...args: unknown[]) => finishWorkout(...args),
  discardWorkout: (...args: unknown[]) => discardWorkout(...args),
}))

// useBlocker (used by the unsaved-changes guard) requires a data router — a
// declarative <MemoryRouter> throws its useDataRouterContext invariant. See
// App.test.tsx for the same createMemoryRouter/RouterProvider pattern.
function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/activity/session', element: <WorkoutSession /> },
      { path: '/activity', element: <p>Activity hub</p> },
      { path: '/activity/workouts', element: <p>Workouts</p> },
      { path: '/activity/history/:logId', element: <p>History detail</p> },
    ],
    { initialEntries: ['/activity/session'] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  // Returned so tests can drive an in-app navigation attempt imperatively —
  // Session itself renders no other internal links/nav (that chrome lives in
  // AthleteAppShell, an ancestor route this test doesn't mount), so this
  // stands in for "the user tapped a nav link or the browser back button".
  return router
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

describe('WorkoutSession touch target sizing', () => {
  beforeEach(() => {
    saveSet.mockClear()
  })

  it('renders the complete-set checkmark button and the timed duration input at 44px', async () => {
    renderPage()

    const durationInput = await screen.findByLabelText('Séria 1 trvanie v sekundách')
    expect(durationInput.className).toMatch(/\bmin-h-11\b/)

    const completeButton = screen.getByLabelText('Dokončiť sériu 1')
    expect(completeButton.className).toMatch(/\bmin-h-11\b/)
    expect(completeButton.className).toMatch(/\bmin-w-11\b/)
  })

  // Regression test for a bug the 44px fix itself introduced: timed rows used to
  // stay on a 4-column *fixed* mobile grid (grid-cols-[2.5rem_1fr_1fr_6.5rem]).
  // Once the trailing Actions track widened to fit two 44px buttons, the two
  // remaining 1fr tracks were squeezed to ~65.5px each at a 375px viewport, and
  // the duration track's own 44px stopwatch button (plus gap-1) ate 48px of that,
  // leaving ~17.5px for the duration input — an unusable sliver. The fix wraps
  // timed rows to the same 2-column mobile grid non-timed rows already use, with
  // the Actions cell spanning both columns, so this asserts that template (not the
  // old fixed-track one) is what actually renders.
  it("wraps the timed row's mobile grid to 2 columns so the duration input isn't squeezed under the stopwatch button", async () => {
    renderPage()

    const durationInput = await screen.findByLabelText('Séria 1 trvanie v sekundách')
    const row = durationInput.closest('.grid')
    expect(row).not.toBeNull()
    expect(row!.className).toMatch(/\bgrid-cols-2\b/)
    expect(row!.className).not.toMatch(/grid-cols-\[2\.5rem_1fr_1fr_6\.5rem\]/)

    const completeButton = screen.getByLabelText('Dokončiť sériu 1')
    expect(completeButton.parentElement?.className).toMatch(/\bcol-span-2\b/)
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

// A dedicated single-exercise, weight/reps fixture whose first set is sort_order 1 —
// distinct from the shared ACTIVE_LOG/WORKOUT_ROW above, where the weight/reps set
// (Bench Press) is deliberately sort_order 2. Two sets so canDelete (set_logs.length > 1)
// is true and the delete button actually renders.
const RPE_ACTIVE_LOG = {
  id: 'log-2',
  user_id: 'athlete-1',
  workout_id: 'workout-2',
  workout_name: 'Mobile RPE Workout',
  duration_minutes: 0,
  notes: null,
  status: 'in_progress' as const,
  logged_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  exercise_logs: [
    {
      id: 'ex-log-3',
      workout_log_id: 'log-2',
      exercise_id: 'ex-3',
      exercise_name: 'Squat',
      notes: null,
      sets_completed: null,
      reps_completed: null,
      weight_kg: null,
      set_logs: [
        { id: 'set-3', exercise_log_id: 'ex-log-3', sort_order: 1, target_reps: 10, actual_reps: null, target_weight_kg: null, actual_weight_kg: null, rpe: null, target_rest_seconds: 90, actual_rest_seconds: null, actual_duration_seconds: null, completed: false },
        { id: 'set-4', exercise_log_id: 'ex-log-3', sort_order: 2, target_reps: 10, actual_reps: null, target_weight_kg: null, actual_weight_kg: null, rpe: null, target_rest_seconds: 90, actual_rest_seconds: null, actual_duration_seconds: null, completed: false },
      ],
    },
  ],
}

const RPE_WORKOUT_ROW = {
  id: 'workout-2',
  user_id: null,
  owner_user_id: null,
  name: 'Mobile RPE Workout',
  day_of_week: null,
  duration_minutes: 30,
  notes: null,
  is_active: true,
  source: 'coach' as const,
  workout_exercises: [
    {
      id: 'we-3',
      workout_id: 'workout-2',
      exercise_id: 'ex-3',
      name: 'Squat',
      muscle_group: null,
      sets: 2,
      reps: '10',
      log_type: 'weight_reps' as const,
      target_duration_seconds: null,
      rest_seconds: 90,
      tips: null,
      sort_order: 1,
    },
  ],
}

describe('WorkoutSession mobile RPE and delete-set controls', () => {
  beforeEach(() => {
    getActiveWorkout.mockResolvedValue(RPE_ACTIVE_LOG)
    getWorkout.mockResolvedValue(RPE_WORKOUT_ROW)
  })

  afterEach(() => {
    // Restore the shared defaults other describe blocks in this file rely on.
    getActiveWorkout.mockResolvedValue(ACTIVE_LOG)
    getWorkout.mockResolvedValue(WORKOUT_ROW)
  })

  it('renders exactly one RPE input for a weight/reps set, unhidden and touch-sized', async () => {
    renderPage()

    const rpeInputs = await screen.findAllByLabelText('Séria 1 RPE')
    expect(rpeInputs).toHaveLength(1)
    expect(rpeInputs[0].className).not.toMatch(/\bhidden\b/)
    expect(rpeInputs[0].className).toMatch(/\bmin-h-11\b/)
  })

  it('shows the delete-set button unhidden with a 44px tap target', async () => {
    renderPage()

    const deleteButton = await screen.findByLabelText('Odstrániť sériu 1')
    expect(deleteButton.className).not.toMatch(/\bhidden\b/)
    expect(deleteButton.className).toMatch(/\bmin-h-11\b/)
    expect(deleteButton.className).toMatch(/\bmin-w-11\b/)
  })

  it('deletes only on click, calling removeSet with the set id', async () => {
    const user = userEvent.setup()
    renderPage()

    const deleteButton = await screen.findByLabelText('Odstrániť sériu 1')
    expect(removeSet).not.toHaveBeenCalled()

    await user.click(deleteButton)
    // TanStack Query calls a bare mutationFn as (variables, context) — assert on the
    // variable it was actually invoked with rather than toHaveBeenCalledWith, which
    // would also have to match react-query's internal context object.
    expect(removeSet.mock.calls[0][0]).toBe('set-3')
    // onDelete's success handler invalidates and refetches the active-workout query
    // outside userEvent's own act scope; flush it before the test tears down so
    // React doesn't warn about a state update after the fact.
    await act(async () => {})
  })
})

describe('WorkoutSession discard confirmation dialog', () => {
  beforeEach(() => {
    discardWorkout.mockClear()
  })

  it('opens the styled ConfirmDialog on click without discarding, then discards only on confirm', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Zahodiť' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Zahodiť tréning?')).toBeInTheDocument()
    expect(within(dialog).getByText('Uložené série zostanú v zahodenom tréningu, ale nebudú sa započítavať do pokroku.')).toBeInTheDocument()
    expect(discardWorkout).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Zahodiť' }))
    // Same reasoning as the delete-set assertion above: check the variables, not the
    // full call signature, since react-query appends its own context argument.
    // discardWorkout(userId, logId) — the userId must lead so a discard can never
    // touch a row it doesn't own.
    expect(discardWorkout.mock.calls[0][0]).toBe('athlete-1')
    expect(discardWorkout.mock.calls[0][1]).toBe('log-1')
  })

  it('cancelling the dialog closes it and runs no mutation', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Zahodiť' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Pokračovať v tréningu' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(discardWorkout).not.toHaveBeenCalled()
  })
})

describe('WorkoutSession unsaved-changes guard', () => {
  beforeEach(() => {
    discardWorkout.mockClear()
    finishWorkout.mockClear()
  })

  it('blocks an in-app navigation attempt while a set holds a typed-but-unsaved value', async () => {
    const user = userEvent.setup()
    const router = renderPage()

    // Bench Press's set-2 (sort_order 2, weight/reps) starts with no actual_reps —
    // typing into it without check-marking is exactly the "typed but not
    // check-marked" case the guard exists for.
    const repsInput = await screen.findByLabelText('Séria 2 opakovania')
    await user.type(repsInput, '8')

    // Simulate the user tapping away (a nav link or the browser back button) —
    // Session itself renders no such link, so drive the router directly.
    await act(async () => { router.navigate('/activity') })

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Zahodiť neuložené zmeny?')).toBeInTheDocument()
    expect(within(dialog).getByText('Máš rozpracované zmeny, ktoré sa neuložili. Ak odídeš, prídeš o ne.')).toBeInTheDocument()
    expect(screen.queryByText('Activity hub')).not.toBeInTheDocument()
  })

  it('Zostať cancels the navigation and keeps the typed value on the page', async () => {
    const user = userEvent.setup()
    const router = renderPage()

    const repsInput = (await screen.findByLabelText('Séria 2 opakovania')) as HTMLInputElement
    await user.type(repsInput, '8')

    await act(async () => { router.navigate('/activity') })
    const dialog = await screen.findByRole('dialog')

    await user.click(within(dialog).getByRole('button', { name: 'Zostať' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Activity hub')).not.toBeInTheDocument()
    expect(repsInput.value).toBe('8')
  })

  it('Odísť proceeds with the navigation, discarding the typed value', async () => {
    const user = userEvent.setup()
    const router = renderPage()

    const repsInput = await screen.findByLabelText('Séria 2 opakovania')
    await user.type(repsInput, '8')

    await act(async () => { router.navigate('/activity') })
    const dialog = await screen.findByRole('dialog')

    await user.click(within(dialog).getByRole('button', { name: 'Odísť' }))

    expect(await screen.findByText('Activity hub')).toBeInTheDocument()
  })

  it('discards without ever showing the unsaved-changes dialog, even with a typed-but-unsaved set value', async () => {
    const user = userEvent.setup()
    renderPage()

    const repsInput = await screen.findByLabelText('Séria 2 opakovania')
    await user.type(repsInput, '8')

    await user.click(screen.getByRole('button', { name: 'Zahodiť' }))
    const discardDialog = await screen.findByRole('dialog')
    expect(within(discardDialog).getByText('Zahodiť tréning?')).toBeInTheDocument()

    await user.click(within(discardDialog).getByRole('button', { name: 'Zahodiť' }))

    expect(discardWorkout.mock.calls[0][0]).toBe('athlete-1')
    expect(discardWorkout.mock.calls[0][1]).toBe('log-1')
    expect(await screen.findByText('Activity hub')).toBeInTheDocument()
    expect(screen.queryByText('Zahodiť neuložené zmeny?')).not.toBeInTheDocument()
  })
})

// A dedicated fixture with one set already completed (so the Finish button is
// enabled from mount — the shared ACTIVE_LOG fixture has none) and a second,
// incomplete set to type an unsaved value into.
const FINISH_ACTIVE_LOG = {
  id: 'log-3',
  user_id: 'athlete-1',
  workout_id: 'workout-3',
  workout_name: 'Finish Workout',
  duration_minutes: 0,
  notes: null,
  status: 'in_progress' as const,
  logged_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  exercise_logs: [
    {
      id: 'ex-log-5',
      workout_log_id: 'log-3',
      exercise_id: 'ex-5',
      exercise_name: 'Deadlift',
      notes: null,
      sets_completed: null,
      reps_completed: null,
      weight_kg: null,
      set_logs: [
        { id: 'set-5', exercise_log_id: 'ex-log-5', sort_order: 1, target_reps: 5, actual_reps: 5, target_weight_kg: null, actual_weight_kg: 100, rpe: 8, target_rest_seconds: 120, actual_rest_seconds: null, actual_duration_seconds: null, completed: true },
        { id: 'set-6', exercise_log_id: 'ex-log-5', sort_order: 2, target_reps: 5, actual_reps: null, target_weight_kg: null, actual_weight_kg: null, rpe: null, target_rest_seconds: 120, actual_rest_seconds: null, actual_duration_seconds: null, completed: false },
      ],
    },
  ],
}

const FINISH_WORKOUT_ROW = {
  id: 'workout-3',
  user_id: null,
  owner_user_id: null,
  name: 'Finish Workout',
  day_of_week: null,
  duration_minutes: 30,
  notes: null,
  is_active: true,
  source: 'coach' as const,
  workout_exercises: [
    {
      id: 'we-5',
      workout_id: 'workout-3',
      exercise_id: 'ex-5',
      name: 'Deadlift',
      muscle_group: null,
      sets: 2,
      reps: '5',
      log_type: 'weight_reps' as const,
      target_duration_seconds: null,
      rest_seconds: 120,
      tips: null,
      sort_order: 1,
    },
  ],
}

describe('WorkoutSession finish flow bypasses the unsaved-changes guard', () => {
  beforeEach(() => {
    getActiveWorkout.mockResolvedValue(FINISH_ACTIVE_LOG)
    getWorkout.mockResolvedValue(FINISH_WORKOUT_ROW)
    finishWorkout.mockClear()
  })

  afterEach(() => {
    // Restore the shared defaults other describe blocks in this file rely on.
    getActiveWorkout.mockResolvedValue(ACTIVE_LOG)
    getWorkout.mockResolvedValue(WORKOUT_ROW)
  })

  it('finishes without ever showing the unsaved-changes dialog, even with a typed-but-unsaved set value', async () => {
    const user = userEvent.setup()
    renderPage()

    const repsInput = await screen.findByLabelText('Séria 2 opakovania')
    await user.type(repsInput, '3')

    const finishButton = screen.getByRole('button', { name: 'Ukončiť tréning' })
    expect(finishButton).not.toBeDisabled()
    await user.click(finishButton)

    expect(finishWorkout.mock.calls[0][0]).toMatchObject({ id: 'log-3' })
    expect(await screen.findByText('History detail')).toBeInTheDocument()
    expect(screen.queryByText('Zahodiť neuložené zmeny?')).not.toBeInTheDocument()
  })
})
