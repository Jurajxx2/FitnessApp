import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { CheckInsSection } from './CheckInsSection'
import { supabase } from '../../lib/supabase'

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

  describe('mutationFn passed to useMutation (the real save logic)', () => {
    // useMutation itself is mocked above so `mutate` never runs the real save logic.
    // These tests grab the actual `mutationFn`/`onError` the component builds and
    // invoke them directly, exercising the exact code path react-query would run.
    function renderAndGetMutationConfig() {
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
      const mutationCalls = vi.mocked(useMutation).mock.calls
      return mutationCalls[mutationCalls.length - 1]![0] as {
        mutationFn: (vars: { id: string; response: string }) => Promise<unknown>
        onSuccess: () => void
        onError: (error: Error) => void
      }
    }

    it('rejects (so onSuccess never fires) when the update matches zero rows', async () => {
      // Simulates an UPDATE denied by RLS on another coach's client: Supabase/PostgREST
      // returns no error, just an empty affected-rows array.
      const select = vi.fn().mockResolvedValue({ data: [], error: null })
      const eq = vi.fn().mockReturnValue({ select })
      const update = vi.fn().mockReturnValue({ eq })
      vi.mocked(supabase.from).mockReturnValue({ update } as any)

      const { mutationFn } = renderAndGetMutationConfig()

      // react-query only calls onSuccess when mutationFn resolves. Proving mutationFn
      // rejects here is sufficient to guarantee the success toast/invalidation never
      // fires for a zero-row update.
      await expect(mutationFn({ id: 'c1', response: 'nice work' })).rejects.toThrow(
        /affected no rows|permission/i
      )
      expect(select).toHaveBeenCalled()
    })

    it('surfaces the zero-rows error through onError (the existing error-toast path)', async () => {
      const select = vi.fn().mockResolvedValue({ data: [], error: null })
      const eq = vi.fn().mockReturnValue({ select })
      const update = vi.fn().mockReturnValue({ eq })
      vi.mocked(supabase.from).mockReturnValue({ update } as any)

      const { mutationFn, onError } = renderAndGetMutationConfig()

      let caught: Error | undefined
      try {
        await mutationFn({ id: 'c1', response: 'nice work' })
      } catch (e) {
        caught = e as Error
      }
      expect(caught).toBeDefined()
      // Wiring check: feeding the rejection into the component's own onError must not
      // throw, confirming the error is handled by the existing UI error-surfacing path
      // rather than propagating as an unhandled rejection.
      expect(() => onError(caught as Error)).not.toThrow()
    })

    it('resolves without throwing when the update matches a row (happy path still works)', async () => {
      const select = vi.fn().mockResolvedValue({ data: [{ id: 'c1', coach_response: 'nice work' }], error: null })
      const eq = vi.fn().mockReturnValue({ select })
      const update = vi.fn().mockReturnValue({ eq })
      vi.mocked(supabase.from).mockReturnValue({ update } as any)

      const { mutationFn } = renderAndGetMutationConfig()

      await expect(mutationFn({ id: 'c1', response: 'nice work' })).resolves.not.toThrow()
    })
  })
})
