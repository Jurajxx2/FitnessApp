import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { CheckInsSection } from './CheckInsSection'

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))
vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn(), storage: { from: vi.fn() } } }))
vi.mock('../../lib/storage', () => ({ signedCheckInPhotoUrl: vi.fn().mockResolvedValue(null) }))

const mutate = vi.fn()

describe('CheckInsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useMutation).mockReturnValue({ mutate, isPending: false } as any)
  })
  afterEach(() => cleanup())

  it('shows empty state when there are no check-ins', () => {
    vi.mocked(useQuery).mockReturnValue({ data: [], isLoading: false } as any)
    render(<CheckInsSection userId="u1" adminUserId="admin1" />)
    expect(screen.getByText('No check-ins yet.')).toBeDefined()
  })

  it('renders a check-in and its metrics', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{
        id: 'c1', user_id: 'u1', week_of: '2026-07-06', weight_kg: 74, energy_level: 4,
        sleep_quality: 3, stress_level: 2, training_adherence: 3, nutrition_adherence: 5,
        notes: 'good week', photo_front_path: null, photo_side_path: null,
        coach_id: null, coach_response: null, coach_response_at: null, created_at: '2026-07-06T00:00:00Z',
      }],
      isLoading: false,
    } as any)
    render(<CheckInsSection userId="u1" adminUserId="admin1" />)
    expect(screen.getByText('Week of 2026-07-06')).toBeDefined()
    expect(screen.getByText('good week')).toBeDefined()
    expect(screen.getByPlaceholderText('Write coach response…')).toBeDefined()
    // Metric labels
    expect(screen.getByText('Weight')).toBeDefined()
    expect(screen.getByText('Energy')).toBeDefined()
    expect(screen.getByText('Sleep')).toBeDefined()
    expect(screen.getByText('Stress')).toBeDefined()
    expect(screen.getByText('Training')).toBeDefined()
    expect(screen.getByText('Nutrition')).toBeDefined()
    // Metric values
    expect(screen.getByText('74 kg')).toBeDefined()
    expect(screen.getByText('4')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
    expect(screen.getByText('5')).toBeDefined()
    // Value '3' appears twice (sleep_quality and training_adherence)
    const threeElements = screen.getAllByText('3')
    expect(threeElements).toHaveLength(2)
  })

  it('submits a coach response', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{
        id: 'c1', user_id: 'u1', week_of: '2026-07-06', weight_kg: null, energy_level: null,
        sleep_quality: null, stress_level: null, training_adherence: null, nutrition_adherence: null,
        notes: null, photo_front_path: null, photo_side_path: null,
        coach_id: null, coach_response: null, coach_response_at: null, created_at: '2026-07-06T00:00:00Z',
      }],
      isLoading: false,
    } as any)
    render(<CheckInsSection userId="u1" adminUserId="admin1" />)
    fireEvent.change(screen.getByPlaceholderText('Write coach response…'), { target: { value: 'nice work' } })
    fireEvent.click(screen.getByText('Respond'))
    expect(mutate).toHaveBeenCalledWith({ id: 'c1', response: 'nice work' })
  })
})
