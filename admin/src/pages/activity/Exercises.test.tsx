import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Exercises from './Exercises'

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  keepPreviousData: Symbol('keepPreviousData'),
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'athlete-1' } }),
}))
vi.mock('../../activity/api', () => ({
  EXERCISE_PAGE_SIZE: 24,
  getExercisePage: vi.fn(),
  getExercise: vi.fn(),
  getFavoriteExerciseIds: vi.fn(),
  setExerciseFavorite: vi.fn(),
}))

const EXERCISE = {
  id: 'ex-1',
  name_en: 'Zercher Squat',
  name_cs: null,
  description_en: '',
  description_cs: null,
  image_url: null,
  image_url_2: null,
  video_url: null,
  difficulty: 'advanced',
  primary_muscles: ['quads'],
  secondary_muscles: [],
  equipment_names: [],
  exercise_categories: null,
}

const FAVORITES_RETURN = { data: [], isLoading: false, isError: false }

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/activity/exercises']}>
      <Exercises />
    </MemoryRouter>
  )
}

// Every mocked useQuery call is routed through this so both the favourites query and
// the exercise-page query (which share the same mocked hook) resolve appropriately.
function mockQueries(exerciseReturn: unknown) {
  vi.mocked(useQuery).mockImplementation((options: any) => {
    if (options.queryKey[1] === 'exercise-favorites') return FAVORITES_RETURN as any
    return exerciseReturn as any
  })
}

describe('Exercises library page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => cleanup())

  it('keeps the search input, difficulty filter and favourites toggle mounted while the exercise page query is loading', () => {
    // Simulates placeholderData: keepPreviousData — a previous page's results are
    // present while isLoading reports true for the newly keyed query. The chrome
    // above the results section must not unmount for this (or any) loading state.
    mockQueries({ data: { data: [EXERCISE], count: 1 }, isLoading: true, isError: false })

    renderPage()

    expect(screen.getByPlaceholderText('Hľadať cvik alebo sval…')).toBeInTheDocument()
    expect(screen.getByLabelText('Filtrovať podľa náročnosti')).toBeInTheDocument()
    expect(screen.getByText('Obľúbené')).toBeInTheDocument()
  })

  it('does not lose focus in the search input while a query is in flight', () => {
    mockQueries({ data: { data: [EXERCISE], count: 1 }, isLoading: true, isError: false })
    renderPage()

    const input = screen.getByPlaceholderText('Hľadať cvik alebo sval…')
    fireEvent.change(input, { target: { value: 'zerc' } })
    expect(document.body.contains(input)).toBe(true)
    expect(screen.getByPlaceholderText('Hľadať cvik alebo sval…')).toHaveValue('zerc')
  })

  it('does not blank the search box when paging forward', () => {
    mockQueries({ data: { data: [EXERCISE], count: 50 }, isLoading: false, isError: false })
    renderPage()

    fireEvent.change(screen.getByPlaceholderText('Hľadať cvik alebo sval…'), { target: { value: 'zercher' } })
    fireEvent.click(screen.getByLabelText('Ďalšia strana'))

    expect(screen.getByPlaceholderText('Hľadať cvik alebo sval…')).toHaveValue('zercher')
  })

  it('resets the page to 0 when the difficulty filter changes', () => {
    const capturedKeys: unknown[][] = []
    vi.mocked(useQuery).mockImplementation((options: any) => {
      if (options.queryKey[1] === 'exercise-favorites') return FAVORITES_RETURN as any
      capturedKeys.push(options.queryKey)
      // count > EXERCISE_PAGE_SIZE so the Pagination "Ďalšia strana" control is enabled.
      return { data: { data: [EXERCISE], count: 50 }, isLoading: false, isError: false } as any
    })

    renderPage()

    // Move off page 0 first, so resetting to 0 on filter change is an observable change.
    fireEvent.click(screen.getByLabelText('Ďalšia strana'))
    const keyAfterPaging = capturedKeys[capturedKeys.length - 1]!
    expect(keyAfterPaging[6]).toBe(1)

    fireEvent.change(screen.getByLabelText('Filtrovať podľa náročnosti'), { target: { value: 'advanced' } })
    const keyAfterFilterChange = capturedKeys[capturedKeys.length - 1]!
    expect(keyAfterFilterChange[4]).toBe('advanced')
    expect(keyAfterFilterChange[6]).toBe(0)
  })

  it('resets the page to 0 when the favourites toggle changes', () => {
    const capturedKeys: unknown[][] = []
    vi.mocked(useQuery).mockImplementation((options: any) => {
      if (options.queryKey[1] === 'exercise-favorites') return FAVORITES_RETURN as any
      capturedKeys.push(options.queryKey)
      return { data: { data: [EXERCISE], count: 50 }, isLoading: false, isError: false } as any
    })

    renderPage()

    fireEvent.click(screen.getByLabelText('Ďalšia strana'))
    expect(capturedKeys[capturedKeys.length - 1]![6]).toBe(1)

    fireEvent.click(screen.getByText('Obľúbené'))
    const keyAfterToggle = capturedKeys[capturedKeys.length - 1]!
    // Favourites-filter segment turns into the (empty, per FAVORITES_RETURN) id array once toggled on.
    expect(keyAfterToggle[5]).toEqual([])
    expect(keyAfterToggle[6]).toBe(0)
  })

  it('keys the exercise query by the actual favourite ids, not just the favoritesOnly flag', () => {
    // Regression test: the query key must change when the favourites *list* changes (e.g.
    // un-favouriting on the detail page invalidates ['activity','exercise-favorites',userId]),
    // not just when the on/off toggle flips. A boolean-only key would keep serving a stale
    // cached page after that invalidation. TanStack Query hashes array segments structurally,
    // so an id-array key segment is valid and gives the desired refetch-on-change behaviour.
    const capturedKeys: unknown[][] = []
    const favoritesReturn = { data: ['ex-1', 'ex-2'], isLoading: false, isError: false }
    vi.mocked(useQuery).mockImplementation((options: any) => {
      if (options.queryKey[1] === 'exercise-favorites') return favoritesReturn as any
      capturedKeys.push(options.queryKey)
      return { data: { data: [EXERCISE], count: 1 }, isLoading: false, isError: false } as any
    })

    renderPage()
    // favoritesOnly starts off: the filter segment must be null, never the boolean `false`.
    expect(capturedKeys[capturedKeys.length - 1]![5]).toBeNull()

    fireEvent.click(screen.getByText('Obľúbené'))
    // favoritesOnly toggled on: the filter segment must be the actual id array, never the boolean `true`.
    expect(capturedKeys[capturedKeys.length - 1]![5]).toEqual(['ex-1', 'ex-2'])
  })

  it('shows the Slovak empty state when no exercises match the filters', () => {
    mockQueries({ data: { data: [], count: 0 }, isLoading: false, isError: false })
    renderPage()

    expect(screen.getByText('Žiadne cviky nezodpovedajú týmto filtrom.')).toBeInTheDocument()
  })

  it('shows the error state when the exercise query fails', () => {
    mockQueries({ data: undefined, isLoading: false, isError: true })
    renderPage()

    expect(screen.getByText('Knižnicu cvikov sa nepodarilo načítať.')).toBeInTheDocument()
  })
})
