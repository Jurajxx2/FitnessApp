import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import CheckInHistory from './CheckInHistory'
import type { CheckInRow } from '../../types/database'

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'athlete-1' } }),
}))

function checkInFixture(overrides: Partial<CheckInRow> = {}): CheckInRow {
  return {
    id: 'c1',
    user_id: 'athlete-1',
    week_of: '2026-07-06',
    weight_kg: null,
    energy_level: null,
    sleep_quality: null,
    stress_level: null,
    training_adherence: null,
    nutrition_adherence: null,
    notes: null,
    photo_front_path: null,
    photo_side_path: null,
    coach_id: null,
    coach_response: null,
    coach_response_at: null,
    created_at: '2026-07-06T00:00:00Z',
    updated_at: '2026-07-06T00:00:00Z',
    ...overrides,
  }
}

// The component drives two distinct useQuery consumers: its own check-ins page
// query (via useCheckIns) and one CheckInPhoto query per photo path. Both go
// through the same mocked useQuery, so branch on the query key to serve each.
function mockCheckIns(checkIns: CheckInRow[]) {
  vi.mocked(useQuery).mockImplementation((options: any) => {
    if (options.queryKey[0] === 'checkin-photo') {
      return { data: `https://signed.example/${options.queryKey[1]}` } as any
    }
    return { data: { data: checkIns, count: checkIns.length }, isLoading: false, error: null } as any
  })
}

function renderPage() {
  render(
    <MemoryRouter>
      <CheckInHistory />
    </MemoryRouter>
  )
}

describe('CheckInHistory', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => cleanup())

  it('shows both photos and the Fotky label when both paths exist', () => {
    mockCheckIns([checkInFixture({ photo_front_path: 'athlete-1/front.jpg', photo_side_path: 'athlete-1/side.jpg' })])
    renderPage()

    expect(screen.getByText('Fotky')).toBeInTheDocument()
    const front = screen.getByAltText('Fotka spredu') as HTMLImageElement
    const side = screen.getByAltText('Fotka z boku') as HTMLImageElement
    expect(front.src).toBe('https://signed.example/athlete-1/front.jpg')
    expect(side.src).toBe('https://signed.example/athlete-1/side.jpg')
  })

  it('shows one photo when only one path exists', () => {
    mockCheckIns([checkInFixture({ photo_front_path: 'athlete-1/front.jpg', photo_side_path: null })])
    renderPage()

    expect(screen.getByText('Fotky')).toBeInTheDocument()
    expect(screen.getByAltText('Fotka spredu')).toBeInTheDocument()
    expect(screen.queryByAltText('Fotka z boku')).not.toBeInTheDocument()
  })

  it('shows no Fotky label or photos when neither path exists', () => {
    mockCheckIns([checkInFixture({ photo_front_path: null, photo_side_path: null })])
    renderPage()

    expect(screen.queryByText('Fotky')).not.toBeInTheDocument()
    expect(screen.queryByAltText('Fotka spredu')).not.toBeInTheDocument()
    expect(screen.queryByAltText('Fotka z boku')).not.toBeInTheDocument()
  })

  it('renders the weight trend with a correct summary for three weighed check-ins', () => {
    // Real query order is newest week_of first; the component must re-sort ascending.
    mockCheckIns([
      checkInFixture({ id: 'c3', week_of: '2026-07-20', weight_kg: 80.1 }),
      checkInFixture({ id: 'c2', week_of: '2026-07-13', weight_kg: 81 }),
      checkInFixture({ id: 'c1', week_of: '2026-07-06', weight_kg: 82.4 }),
    ])
    renderPage()

    expect(screen.getByText('Vývoj hmotnosti')).toBeInTheDocument()
    expect(screen.getByText('82,4 kg → 80,1 kg (−2,3 kg)')).toBeInTheDocument()

    const svg = screen.getByRole('img', { name: 'Vývoj hmotnosti' })
    expect(svg.querySelector('polyline')?.getAttribute('points')?.trim().split(' ')).toHaveLength(3)
  })

  it('renders no weight trend for a single weighed check-in', () => {
    mockCheckIns([checkInFixture({ id: 'c1', week_of: '2026-07-06', weight_kg: 82.4 })])
    renderPage()

    expect(screen.queryByText('Vývoj hmotnosti')).not.toBeInTheDocument()
  })

  it('renders no weight trend when there are no weighed check-ins at all', () => {
    mockCheckIns([checkInFixture({ id: 'c1', week_of: '2026-07-06', weight_kg: null })])
    renderPage()

    expect(screen.queryByText('Vývoj hmotnosti')).not.toBeInTheDocument()
  })
})
