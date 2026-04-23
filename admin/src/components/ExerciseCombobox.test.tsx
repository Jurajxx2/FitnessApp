import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ExerciseCombobox } from './ExerciseCombobox'

const mockResults = vi.hoisted(() => [
  { id: '1', name_en: 'Bench Press', primary_muscles: ['Chest'], image_url: null },
  { id: '2', name_en: 'Incline Bench Press', primary_muscles: ['Chest'], image_url: null },
])

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockResults }),
    }),
  },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('ExerciseCombobox', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders an input with placeholder', () => {
    render(<ExerciseCombobox value="" onChange={vi.fn()} />, { wrapper })
    expect(screen.getByPlaceholderText('e.g. Bench Press')).toBeDefined()
  })

  it('calls onChange with text and empty muscle group on free text input', () => {
    const onChange = vi.fn()
    render(<ExerciseCombobox value="" onChange={onChange} />, { wrapper })
    fireEvent.change(screen.getByPlaceholderText('e.g. Bench Press'), { target: { value: 'squat' } })
    expect(onChange).toHaveBeenCalledWith('squat', '')
  })

  it('shows dropdown results after typing 2+ characters', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    render(<ExerciseCombobox value="" onChange={vi.fn()} />, { wrapper })
    fireEvent.change(screen.getByPlaceholderText('e.g. Bench Press'), { target: { value: 'bench' } })
    await act(async () => { vi.advanceTimersByTime(250) })
    vi.useRealTimers()
    await waitFor(() => expect(screen.queryByText('Bench Press')).toBeDefined())
  })

  it('calls onChange with name and muscle group on selection', async () => {
    const onChange = vi.fn()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    render(<ExerciseCombobox value="" onChange={onChange} />, { wrapper })
    fireEvent.change(screen.getByPlaceholderText('e.g. Bench Press'), { target: { value: 'bench' } })
    await act(async () => { vi.advanceTimersByTime(250) })
    vi.useRealTimers()
    await waitFor(() => screen.getByText('Bench Press'))
    fireEvent.click(screen.getByText('Bench Press'))
    expect(onChange).toHaveBeenCalledWith('Bench Press', 'Chest')
  })

  it('closes dropdown on Escape', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    render(<ExerciseCombobox value="" onChange={vi.fn()} />, { wrapper })
    const input = screen.getByPlaceholderText('e.g. Bench Press')
    fireEvent.change(input, { target: { value: 'bench' } })
    await act(async () => { vi.advanceTimersByTime(250) })
    vi.useRealTimers()
    await waitFor(() => screen.getByText('Bench Press'))
    fireEvent.keyDown(input, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByText('Bench Press')).toBeNull())
  })
})
