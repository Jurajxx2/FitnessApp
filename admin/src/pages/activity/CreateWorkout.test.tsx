import { describe, it, expect, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { NoticeProvider } from '../../components/ui'
import CreateWorkout from './CreateWorkout'

// A single exercise, deliberately named so the log-type heuristic infers
// 'weight_reps' (not 'time' or 'bodyweight_reps'), matching a fresh draft's default.
const EXERCISE_ROW = {
  id: 'ex-1',
  name_en: 'Bench Press',
  name_cs: 'Bench Press',
  category_id: null,
  image_url: null,
  image_url_2: null,
  difficulty: null,
  primary_muscles: ['chest'],
  equipment_names: [],
}

// Generic chainable Postgrest-like builder: every chain method returns itself,
// and the object is thenable so `await` resolves with an empty, error-free result.
function createEmptyQueryBuilder() {
  const result = { data: [], error: null, count: 0 }
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    range: () => builder,
    contains: () => builder,
    overlaps: () => builder,
    in: () => builder,
    textSearch: () => builder,
    single: () => Promise.resolve(result),
    then: (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return builder
}

// The ExercisePicker's main list query is the only one that calls `.range()`
// (paginated); its equipment-options query only calls `.limit()`. Use that to
// return real exercise data for the list query while other reads stay empty.
function createExercisesQueryBuilder() {
  let paginated = false
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    range: () => {
      paginated = true
      return builder
    },
    contains: () => builder,
    overlaps: () => builder,
    in: () => builder,
    textSearch: () => builder,
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(paginated ? { data: [EXERCISE_ROW], count: 1, error: null } : { data: [], count: 0, error: null }).then(resolve, reject),
  }
  return builder
}

// Supports both calls createUserWorkout makes against 'workouts': the initial
// `.insert({...}).select('id').single()`, and the closing `getWorkout()` read
// (`.select(workoutSelect).eq('id', workoutId).single()`). Both only need
// `.id` from the resolved row — sortWorkout defaults workout_exercises to [].
function createWorkoutsBuilder() {
  const builder: Record<string, unknown> = {
    insert: () => builder,
    select: () => builder,
    eq: () => builder,
    single: () => Promise.resolve({ data: { id: 'workout-99' }, error: null }),
  }
  return builder
}

// Supports createUserWorkout's `.from('workout_exercises').insert([...])` call,
// which is awaited directly (no .select()/.single() in the chain).
function createWorkoutExercisesInsertBuilder() {
  return {
    insert: () => Promise.resolve({ error: null }),
  }
}

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'athlete-1' } }),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'exercises') return createExercisesQueryBuilder()
      if (table === 'workouts') return createWorkoutsBuilder()
      if (table === 'workout_exercises') return createWorkoutExercisesInsertBuilder()
      return createEmptyQueryBuilder()
    },
  },
}))

// useBlocker (used by the unsaved-changes guard) requires a data router — a
// declarative <MemoryRouter> throws its useDataRouterContext invariant. See
// App.test.tsx for the same createMemoryRouter/RouterProvider pattern.
function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/activity/workouts/new', element: <CreateWorkout /> },
      { path: '/activity/workouts/:id', element: <p>Workout detail</p> },
    ],
    { initialEntries: ['/activity/workouts/new'] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <NoticeProvider>
        <RouterProvider router={router} />
      </NoticeProvider>
    </QueryClientProvider>
  )
  return router
}

describe('CreateWorkout log_type selector', () => {
  it('swaps Opakovania for Trvanie when marked as Čas, seeds a non-null target, and clears it back to reps', async () => {
    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Pridať Bench Press' }))

    expect(screen.getByLabelText('Opakovania')).toBeInTheDocument()
    expect(screen.queryByLabelText('Trvanie (s)')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Čas' }))

    const durationInput = screen.getByLabelText('Trvanie (s)')
    expect(durationInput).toHaveValue(30)
    expect(screen.queryByLabelText('Opakovania')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Váha + opak.' }))

    expect(screen.getByLabelText('Opakovania')).toHaveValue('10')
    expect(screen.queryByLabelText('Trvanie (s)')).not.toBeInTheDocument()
  })

  it('defaults the toggle to weight_reps as active for a freshly added exercise', async () => {
    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Pridať Bench Press' }))

    expect(screen.getByRole('button', { name: 'Váha + opak.' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Vlastná váha' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Čas' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('exposes exercise details from both the library and selected card without replacing the builder', async () => {
    renderPage()
    const user = userEvent.setup()

    const libraryDetail = await screen.findByRole('link', { name: 'Detail: Bench Press' })
    expect(libraryDetail).toHaveAttribute('href', '/activity/exercises/ex-1')
    expect(libraryDetail).toHaveAttribute('target', '_blank')

    await user.click(screen.getByRole('button', { name: 'Pridať Bench Press' }))
    const selectedDetail = screen.getByRole('link', { name: 'Otvoriť detail cviku Bench Press' })
    expect(selectedDetail).toHaveAttribute('href', '/activity/exercises/ex-1')
    expect(selectedDetail).toHaveAttribute('target', '_blank')
  })
})

describe('CreateWorkout unsaved-changes guard', () => {
  it('blocks an in-app navigation attempt once a name is typed but not yet saved', async () => {
    const user = userEvent.setup()
    const router = renderPage()

    await user.type(screen.getByLabelText('Názov tréningu'), 'Môj tréning')

    // Simulate the user tapping away (a nav link or the browser back button) —
    // CreateWorkout itself renders no such link, so drive the router directly,
    // the same technique used in Session.test.tsx.
    await act(async () => { router.navigate('/activity/workouts/999') })

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Zahodiť neuložené zmeny?')).toBeInTheDocument()
    expect(within(dialog).getByText('Máš rozpracované zmeny, ktoré sa neuložili. Ak odídeš, prídeš o ne.')).toBeInTheDocument()
    expect(screen.queryByText('Workout detail')).not.toBeInTheDocument()
  })

  it('does not block navigation before any name/exercise has been entered', async () => {
    const router = renderPage()

    await act(async () => { router.navigate('/activity/workouts/999') })

    expect(await screen.findByText('Workout detail')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('navigates to the new workout with no unsaved-changes dialog after a successful save', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Názov tréningu'), 'Môj tréning')
    await user.click(await screen.findByRole('button', { name: 'Pridať Bench Press' }))

    await user.click(screen.getByRole('button', { name: 'Uložiť vlastný tréning' }))

    expect(await screen.findByText('Workout detail')).toBeInTheDocument()
    expect(screen.queryByText('Zahodiť neuložené zmeny?')).not.toBeInTheDocument()
  })
})
