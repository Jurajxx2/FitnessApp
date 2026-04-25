import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { useQuery } from '@tanstack/react-query'
import { ExerciseCombobox } from './ExerciseCombobox'

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

const mockResults = [
  { id: '1', name_en: 'Bench Press', primary_muscles: ['Chest'], image_url: null },
  { id: '2', name_en: 'Incline Bench Press', primary_muscles: ['Chest'], image_url: null },
]

describe('ExerciseCombobox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useQuery).mockReturnValue({ data: [] } as any)
  })

  afterEach(() => {
    cleanup()
  })

  it('renders an input with placeholder', () => {
    render(<ExerciseCombobox value="" onChange={vi.fn()} />)
    expect(screen.getByPlaceholderText('e.g. Bench Press')).toBeDefined()
  })

  it('calls onChange with text and empty muscle group on free text input', () => {
    const onChange = vi.fn()
    render(<ExerciseCombobox value="" onChange={onChange} />)
    fireEvent.change(screen.getByPlaceholderText('e.g. Bench Press'), { target: { value: 'squat' } })
    expect(onChange).toHaveBeenCalledWith('squat', '')
  })

  it('shows dropdown results after typing 2+ characters', async () => {
    vi.mocked(useQuery).mockReturnValue({ data: mockResults } as any)
    render(<ExerciseCombobox value="" onChange={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('e.g. Bench Press'), { target: { value: 'bench' } })
    await waitFor(() => expect(screen.queryByText('Bench Press')).not.toBeNull())
  })

  it('calls onChange with name and muscle group on selection', async () => {
    const onChange = vi.fn()
    vi.mocked(useQuery).mockReturnValue({ data: mockResults } as any)
    render(<ExerciseCombobox value="" onChange={onChange} />)
    fireEvent.change(screen.getByPlaceholderText('e.g. Bench Press'), { target: { value: 'bench' } })
    await waitFor(() => screen.getByText('Bench Press'))
    fireEvent.click(screen.getByText('Bench Press'))
    expect(onChange).toHaveBeenCalledWith('Bench Press', 'Chest')
  })

  it('closes dropdown on Escape', async () => {
    vi.mocked(useQuery).mockReturnValue({ data: mockResults } as any)
    render(<ExerciseCombobox value="" onChange={vi.fn()} />)
    const input = screen.getByPlaceholderText('e.g. Bench Press')
    fireEvent.change(input, { target: { value: 'bench' } })
    await waitFor(() => screen.getByText('Bench Press'))
    fireEvent.keyDown(input, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByText('Bench Press')).toBeNull())
  })
})
