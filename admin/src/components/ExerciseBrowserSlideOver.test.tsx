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
  { id: '1', name_en: 'Bench Press', primary_muscles: ['Chest'], image_url: null, category_id: 1 },
  { id: '2', name_en: 'Pull-Up', primary_muscles: ['Back'], image_url: null, category_id: 2 },
]

function setupMocks() {
  vi.mocked(useQuery).mockImplementation(({ queryKey }: any) => {
    if (queryKey[0] === 'exercise-categories') {
      return { data: mockCategories } as any
    }
    return { data: { data: mockExercises, count: 2 } } as any
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
    render(<ExerciseBrowserSlideOver open={true} onClose={vi.fn()} addedNames={[]} onAdd={vi.fn()} />)
    expect(screen.getByPlaceholderText('Search exercises…')).toBeDefined()
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeDefined())
  })

  it('calls onAdd with name and muscle group when + is clicked', async () => {
    const onAdd = vi.fn()
    render(<ExerciseBrowserSlideOver open={true} onClose={vi.fn()} addedNames={[]} onAdd={onAdd} />)
    await waitFor(() => screen.getByText('Bench Press'))
    fireEvent.click(screen.getByLabelText('Add Bench Press'))
    expect(onAdd).toHaveBeenCalledWith('Bench Press', 'Chest')
  })

  it('shows ✓ added badge for exercises already in addedNames', async () => {
    render(<ExerciseBrowserSlideOver open={true} onClose={vi.fn()} addedNames={['Bench Press']} onAdd={vi.fn()} />)
    await waitFor(() => screen.getByText('Bench Press'))
    expect(screen.getByText('✓ added')).toBeDefined()
    expect(screen.queryByLabelText('Add Bench Press')).toBeNull()
  })

  it('calls onClose when Done is clicked', async () => {
    const onClose = vi.fn()
    render(<ExerciseBrowserSlideOver open={true} onClose={onClose} addedNames={[]} onAdd={vi.fn()} />)
    await waitFor(() => screen.getByText('Bench Press'))
    fireEvent.click(screen.getByText('Done'))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders category chips from exercise_categories', async () => {
    render(<ExerciseBrowserSlideOver open={true} onClose={vi.fn()} addedNames={[]} onAdd={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Chest' })).toBeDefined())
    expect(screen.getByRole('button', { name: 'Back' })).toBeDefined()
  })
})
