import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
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
    textSearch: () => builder,
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(paginated ? { data: [EXERCISE_ROW], count: 1, error: null } : { data: [], count: 0, error: null }).then(resolve, reject),
  }
  return builder
}

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'athlete-1' } }),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => (table === 'exercises' ? createExercisesQueryBuilder() : createEmptyQueryBuilder()),
  },
}))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <NoticeProvider>
        <MemoryRouter initialEntries={['/activity/workouts/new']}>
          <CreateWorkout />
        </MemoryRouter>
      </NoticeProvider>
    </QueryClientProvider>
  )
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
})
