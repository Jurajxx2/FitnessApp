import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import History from './History'
import { useMealHistory } from '../../nutrition/hooks'
import type { MealLogRow } from '../../types/database'

vi.mock('../../nutrition/hooks', () => ({
  useMealHistory: vi.fn(),
}))

const mockUseMealHistory = vi.mocked(useMealHistory)

const LOG: MealLogRow = {
  id: 'log-1',
  user_id: 'athlete-1',
  meal_name: 'Raňajky',
  notes: null,
  image_url: null,
  meal_type: 'breakfast',
  logged_at: '2026-07-20T07:00:00Z',
  meal_log_foods: [],
}

function renderPage() {
  render(
    <MemoryRouter>
      <History />
    </MemoryRouter>
  )
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => cleanup())

describe('nutrition History', () => {
  it('keeps the page header mounted while the meal history query is loading', () => {
    // Regression test for the unmount bug: an early `if (isLoading) return <Shimmer/>`
    // above the header meant paging or a background refetch could blank the whole
    // page. isLoading true (a fresh page key with no placeholder yet) must still
    // leave the header in the document.
    mockUseMealHistory.mockReturnValue({ data: undefined, isLoading: true, isFetching: true } as unknown as ReturnType<typeof useMealHistory>)

    renderPage()

    expect(screen.getByText('História jedál')).toBeInTheDocument()
  })

  it('renders meal log groups once loaded', () => {
    mockUseMealHistory.mockReturnValue({ data: { data: [LOG], count: 1 }, isLoading: false, isFetching: false } as unknown as ReturnType<typeof useMealHistory>)

    renderPage()

    expect(screen.getByText('História jedál')).toBeInTheDocument()
    expect(screen.getByText('Raňajky')).toBeInTheDocument()
  })

  it('shows the empty state when there are no logs and not loading', () => {
    mockUseMealHistory.mockReturnValue({ data: { data: [], count: 0 }, isLoading: false, isFetching: false } as unknown as ReturnType<typeof useMealHistory>)

    renderPage()

    expect(screen.getByText('História jedál')).toBeInTheDocument()
    expect(screen.getByText('Zatiaľ žiadne záznamy')).toBeInTheDocument()
  })
})
