import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { NoticeProvider } from '../../components/ui'
import WorkoutEditor from './WorkoutEditor'

// Generic chainable Postgrest-like builder: every chain method returns itself,
// and the object is thenable so `await` resolves with an empty, error-free result.
// This is sufficient for the read queries this page (and the always-mounted
// ExerciseBrowserSlideOver/ExercisePicker) fire on mount in "create" mode.
function createQueryBuilder() {
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

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => createQueryBuilder(),
    rpc: vi.fn(),
  },
}))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/workouts/new']}>
        <NoticeProvider>
          <WorkoutEditor />
        </NoticeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('WorkoutEditor log_type selector', () => {
  it('swaps Reps for Duration when marked as timed, seeds a non-null target, and clears it back to reps', async () => {
    renderPage()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Add custom exercise' }))

    expect(screen.getByLabelText('Reps')).toBeInTheDocument()
    expect(screen.queryByLabelText('Duration (sec)')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Time' }))

    const durationInput = screen.getByLabelText('Duration (sec)')
    expect(durationInput).toHaveValue(30)
    expect(screen.queryByLabelText('Reps')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Weight + Reps' }))

    expect(screen.getByLabelText('Reps')).toHaveValue('10')
    expect(screen.queryByLabelText('Duration (sec)')).not.toBeInTheDocument()
  })

  it('keeps the last valid duration instead of collapsing to 0 when the field is cleared', async () => {
    renderPage()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Add custom exercise' }))
    await user.click(screen.getByRole('button', { name: 'Time' }))

    const durationInput = screen.getByLabelText('Duration (sec)')
    expect(durationInput).toHaveValue(30)

    // Clearing must not persist a 0-second time target — that fails the DB duration CHECK on save.
    await user.clear(durationInput)
    expect(durationInput).toHaveValue(30)
  })

  it('defaults the toggle to weight_reps as active for a freshly added exercise', async () => {
    renderPage()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Add custom exercise' }))

    expect(screen.getByRole('button', { name: 'Weight + Reps' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Bodyweight' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Time' })).toHaveAttribute('aria-pressed', 'false')
  })
})
