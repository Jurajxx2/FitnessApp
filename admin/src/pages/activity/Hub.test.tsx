import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import ActivityHub from './Hub'

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'athlete-1' } }) }))
vi.mock('../../activity/api', () => ({
  getAssignedWorkouts: vi.fn(),
  getWorkoutLibrary: vi.fn(),
  getWorkoutHistory: vi.fn(),
  getActiveWorkout: vi.fn(),
  startWorkout: vi.fn(),
}))
vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn() } }))

type QueryResult = { data?: unknown; isLoading?: boolean; isError?: boolean }

const DEFAULTS: Record<string, QueryResult> = {
  activeQuote: { data: null, isLoading: false, isError: false },
  'activity:assigned': { data: [], isLoading: false, isError: false },
  'activity:library': { data: [], isLoading: false, isError: false },
  'activity:history': { data: [], isLoading: false, isError: false },
  'activity:active': { data: null, isLoading: false, isError: false },
}

// The quote hook and the four workout queries all land in this one mocked
// `useQuery`, so tests branch on the query key: `['activeQuote']` for the quote,
// `['activity', <sub>, …]` for the workout data.
function mockQueries(overrides: Record<string, QueryResult> = {}) {
  const merged = { ...DEFAULTS, ...overrides }
  vi.mocked(useQuery).mockImplementation((options: unknown) => {
    const { queryKey } = options as { queryKey: readonly unknown[] }
    const [type, sub] = queryKey as [string, string?]
    const bucket = type === 'activity' ? `activity:${sub}` : type
    return (merged[bucket] ?? { data: undefined, isLoading: false, isError: false }) as ReturnType<typeof useQuery>
  })
}

/** Applies one result to all four workout queries, leaving the quote alone. */
function allWorkoutQueries(result: QueryResult): Record<string, QueryResult> {
  return {
    'activity:assigned': result,
    'activity:library': result,
    'activity:history': result,
    'activity:active': result,
  }
}

const FLEXIBLE_WORKOUT = {
  id: 'w-flex',
  user_id: 'athlete-1',
  owner_user_id: null,
  name: 'Celotelový tréning',
  day_of_week: null,
  duration_minutes: 45,
  notes: null,
  is_active: true,
  source: 'coach',
  workout_exercises: [],
}

function renderHub() {
  render(<MemoryRouter initialEntries={['/activity']}><ActivityHub /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false } as any)
  mockQueries()
})
afterEach(() => cleanup())

describe('ActivityHub daily quote', () => {
  it('renders the active quote and its author above the page header', () => {
    mockQueries({ activeQuote: { data: { id: 'q1', text: 'Disciplína poráža motiváciu.', author: 'Andrea' }, isLoading: false } })

    renderHub()

    const quote = screen.getByText('Disciplína poráža motiváciu.')
    expect(quote).toBeInTheDocument()
    expect(screen.getByText('— Andrea')).toBeInTheDocument()

    // Task A puts the quote at the very top: the "Aktivita" header must follow it.
    const heading = screen.getByRole('heading', { name: 'Aktivita' })
    expect(quote.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders the quote without an author line when the quote has no author', () => {
    mockQueries({ activeQuote: { data: { id: 'q1', text: 'Konzistentnosť vyhráva.', author: null }, isLoading: false } })

    renderHub()

    expect(screen.getByText('Konzistentnosť vyhráva.')).toBeInTheDocument()
    expect(screen.queryByText(/^—/)).not.toBeInTheDocument()
  })

  it('renders no quote at all when no quote is active', () => {
    mockQueries({ activeQuote: { data: null, isLoading: false } })

    renderHub()

    expect(screen.queryByText('Disciplína poráža motiváciu.')).not.toBeInTheDocument()
    expect(screen.queryByText(/^—/)).not.toBeInTheDocument()
    // The rest of the page is unaffected by the missing quote.
    expect(screen.getByRole('heading', { name: 'Aktivita' })).toBeInTheDocument()
  })

  it('renders no quote and keeps the page usable when the quote query errors', () => {
    mockQueries({ activeQuote: { data: undefined, isLoading: false, isError: true } })

    renderHub()

    expect(screen.queryByText(/^—/)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Aktivita' })).toBeInTheDocument()
    expect(screen.getByText('Zatiaľ nie sú dostupné žiadne aktívne tréningové plány.')).toBeInTheDocument()
  })
})

describe('ActivityHub loading chrome', () => {
  it('keeps the header and the quote mounted while the workout queries are loading', () => {
    // Regression test for the unmount bug: an early `if (isLoading) return <LoadingBlock/>`
    // used to replace the whole page — header included — whenever any of the four
    // workout queries was in flight.
    mockQueries({
      activeQuote: { data: { id: 'q1', text: 'Disciplína poráža motiváciu.', author: 'Andrea' }, isLoading: false },
      ...allWorkoutQueries({ data: undefined, isLoading: true, isError: false }),
    })

    renderHub()

    expect(screen.getByRole('heading', { name: 'Aktivita' })).toBeInTheDocument()
    expect(screen.getByText('Disciplína poráža motiváciu.')).toBeInTheDocument()

    const loading = screen.getByText('Načítava sa aktivita…')
    expect(loading).toBeInTheDocument()
    expect(loading.closest('[aria-busy]')).toHaveAttribute('aria-busy', 'true')
  })

  it('keeps the header mounted and drops aria-busy when a workout query fails', () => {
    mockQueries(allWorkoutQueries({ data: undefined, isLoading: false, isError: true }))

    renderHub()

    expect(screen.getByRole('heading', { name: 'Aktivita' })).toBeInTheDocument()
    const error = screen.getByRole('alert')
    expect(error).toHaveTextContent('Aktivitu sa nepodarilo načítať. Obnov stránku a skús to znova.')
    expect(error.closest('[aria-busy]')).toHaveAttribute('aria-busy', 'false')
  })

  it('marks the swapping region as not busy once the workout queries resolve', () => {
    renderHub()

    expect(screen.queryByText('Načítava sa aktivita…')).not.toBeInTheDocument()
    const region = screen.getByText('Zatiaľ nie sú dostupné žiadne aktívne tréningové plány.').closest('[aria-busy]')
    expect(region).toHaveAttribute('aria-busy', 'false')
  })
})

describe('ActivityHub tap targets', () => {
  it('gives the custom-workout and coach-message actions 44px targets', () => {
    renderHub()

    expect(screen.getByRole('link', { name: /Vlastný tréning/ }).className).toMatch(/\bmin-h-11\b/)
    expect(screen.getByRole('link', { name: 'Napísať trénerke' }).className).toMatch(/\bmin-h-11\b/)
  })

  it('gives the flexible-workout Začať button a 44px target', () => {
    mockQueries({ 'activity:assigned': { data: [FLEXIBLE_WORKOUT], isLoading: false, isError: false } })

    renderHub()

    const start = screen.getByRole('button', { name: 'Začať' })
    expect(start.className).toMatch(/\bmin-h-11\b/)
  })
})
