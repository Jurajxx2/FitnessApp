import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NoticeProvider } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import RecipeEditor from './RecipeEditor'

vi.mock('../../lib/storage', () => ({ uploadRecipePhoto: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn() } }))

function setupSupabase() {
  const recipeInsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'recipe-1' }, error: null }),
    }),
  })
  const ingredientInsert = vi.fn().mockResolvedValue({ error: null })
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'recipes') return { insert: recipeInsert } as never
    if (table === 'recipe_ingredients') return { insert: ingredientInsert } as never
    throw new Error(`Unexpected table in test: ${table}`)
  })
  return { recipeInsert, ingredientInsert }
}

function renderRecipeEditor() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <NoticeProvider>
        <MemoryRouter initialEntries={['/admin/nutrition/recipes/new']}>
          <RecipeEditor />
        </MemoryRouter>
      </NoticeProvider>
    </QueryClientProvider>
  )
}

describe('RecipeEditor ingredient validation', () => {
  afterEach(() => cleanup())

  it('blocks saving when an ingredient row has macro data but no name', async () => {
    const { recipeInsert, ingredientInsert } = setupSupabase()
    renderRecipeEditor()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Recipe name'), 'Overnight Oats')
    const calories = screen.getByLabelText('Calories')
    await user.clear(calories)
    await user.type(calories, '120')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Row 1 has a quantity or macro value but no name. Give it a name or clear its values before saving.'
    )
    expect(screen.getByRole('button', { name: 'Add recipe' })).toBeDisabled()
    expect(recipeInsert).not.toHaveBeenCalled()
    expect(ingredientInsert).not.toHaveBeenCalled()
  })

  it('saves ingredient-derived macros and drops only a pristine row', async () => {
    const { recipeInsert, ingredientInsert } = setupSupabase()
    renderRecipeEditor()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Recipe name'), 'Overnight Oats')
    await user.type(screen.getByLabelText('Name'), 'Oats')
    const calories = screen.getByLabelText('Calories')
    await user.clear(calories)
    await user.type(calories, '300')
    const protein = screen.getByLabelText('Protein (g)')
    await user.clear(protein)
    await user.type(protein, '10')
    await user.click(screen.getByRole('button', { name: 'Add ingredient' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add recipe' }))

    await waitFor(() => expect(recipeInsert).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Overnight Oats',
      calories: 300,
      protein_g: 10,
      carbs_g: 0,
      fat_g: 0,
    })))
    await waitFor(() => expect(ingredientInsert).toHaveBeenCalled())
    const inserted = ingredientInsert.mock.calls[0][0] as Array<{ name: string }>
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({ name: 'Oats', calories: 300, protein_g: 10 })
  })
})
