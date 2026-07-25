import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { useQuery } from '@tanstack/react-query'
import { ExerciseBrowserSlideOver } from './ExerciseBrowserSlideOver'

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

const mockCategories = [
  { id: 1, name: 'Chest' },
  { id: 2, name: 'Back' },
]

const mockExercises = [
  { id: '1', name_en: 'Bench Press', name_cs: 'Tlak na lavičke', primary_muscles: ['Chest'], equipment_names: ['Barbell'], image_url: null, image_url_2: null, category_id: 1, difficulty: 'intermediate' },
  { id: '2', name_en: 'Pull-Up', name_cs: 'Zhyb', primary_muscles: ['Back'], equipment_names: ['Pull-up bar'], image_url: null, image_url_2: null, category_id: 2, difficulty: 'advanced' },
]

function setupMocks() {
  vi.mocked(useQuery).mockImplementation(({ queryKey }: any) => {
    if (queryKey[0] === 'exercise-categories') {
      return { data: mockCategories } as any
    }
    if (queryKey[0] === 'exercise-equipment-options') {
      return { data: ['Barbell', 'Pull-up bar'] } as any
    }
    return { data: { data: mockExercises, count: 30 } } as any
  })
}

describe('ExerciseBrowserSlideOver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders search input and exercise list when open', async () => {
    render(<ExerciseBrowserSlideOver open={true} onClose={vi.fn()} selectedIds={[]} onAdd={vi.fn()} />)
    expect(screen.getByPlaceholderText('Search exercises…')).toBeDefined()
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeDefined())
  })

  it('calls onAdd with name and muscle group when + is clicked', async () => {
    const onAdd = vi.fn()
    render(<ExerciseBrowserSlideOver open={true} onClose={vi.fn()} selectedIds={[]} onAdd={onAdd} />)
    await waitFor(() => screen.getByText('Bench Press'))
    fireEvent.click(screen.getByLabelText('Add Bench Press'))
    expect(onAdd).toHaveBeenCalledWith(mockExercises[0])
  })

  it('shows the added state for exercises already selected', async () => {
    render(<ExerciseBrowserSlideOver open={true} onClose={vi.fn()} selectedIds={['1']} onAdd={vi.fn()} />)
    await waitFor(() => screen.getByText('Bench Press'))
    expect(screen.getByText('Added')).toBeDefined()
    expect(screen.getByLabelText('Added Bench Press')).toBeDisabled()
  })

  it('keeps exercise details separate from the add action', async () => {
    const onAdd = vi.fn()
    render(<ExerciseBrowserSlideOver open={true} onClose={vi.fn()} selectedIds={[]} onAdd={onAdd} />)
    await waitFor(() => screen.getByText('Bench Press'))

    const detail = screen.getByRole('link', { name: 'Details: Bench Press' })
    expect(detail).toHaveAttribute('href', '/admin/exercises/1')
    expect(detail).toHaveAttribute('target', '_blank')
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('calls onClose when Done is clicked', async () => {
    const onClose = vi.fn()
    render(<ExerciseBrowserSlideOver open={true} onClose={onClose} selectedIds={[]} onAdd={vi.fn()} />)
    await waitFor(() => screen.getByText('Bench Press'))
    fireEvent.click(screen.getByText('Done'))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders category chips from exercise_categories', async () => {
    render(<ExerciseBrowserSlideOver open={true} onClose={vi.fn()} selectedIds={[]} onAdd={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Chest' })).toBeDefined())
    expect(screen.getByRole('button', { name: 'Back' })).toBeDefined()
  })

  it('updates the server query when filters and paging change', async () => {
    render(<ExerciseBrowserSlideOver open={true} onClose={vi.fn()} selectedIds={[]} onAdd={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Chest' }))
    expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['exercise-picker', '', 1, [], [], 0] }))

    fireEvent.click(screen.getByRole('button', { name: 'Barbell' }))
    expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['exercise-picker', '', 1, ['Barbell'], [], 0] }))

    fireEvent.click(screen.getByRole('button', { name: 'Intermediate' }))
    expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['exercise-picker', '', 1, ['Barbell'], ['intermediate'], 0] }))

    fireEvent.click(screen.getByLabelText('Next page'))
    expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['exercise-picker', '', 1, ['Barbell'], ['intermediate'], 1] }))
  })
})
