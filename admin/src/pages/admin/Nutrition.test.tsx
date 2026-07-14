import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NoticeProvider } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import RecipeEditor from './RecipeEditor'

vi.mock('../../lib/storage', () => ({ uploadRecipePhoto: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }))

function setupSupabase() {
  const saveRecipe = vi.fn().mockResolvedValue({ data: 'recipe-1', error: null })
  const updateRecipe = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
  vi.mocked(supabase.rpc).mockImplementation(saveRecipe)
  vi.mocked(supabase.from).mockReturnValue({ update: updateRecipe } as never)
  return { saveRecipe, updateRecipe }
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
    const { saveRecipe } = setupSupabase()
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
    expect(saveRecipe).not.toHaveBeenCalled()
  })

  it('sends only named ingredient rows to the atomic recipe RPC', async () => {
    const { saveRecipe, updateRecipe } = setupSupabase()
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

    await waitFor(() => expect(saveRecipe).toHaveBeenCalledWith('admin_save_recipe', expect.objectContaining({
      p_name: 'Overnight Oats',
    })))
    const inserted = saveRecipe.mock.calls[0][1].p_ingredients as Array<{ name: string }>
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({ name: 'Oats', calories: 300, protein_g: 10 })

    expect(updateRecipe).toHaveBeenCalledWith(expect.objectContaining({
      eligible_for_generator: false,
      macros_verified: false,
      is_scalable: true,
      allowed_portions: null,
      fiber_g: null,
      meal_types: [],
      dietary_patterns: [],
      allergens: [],
    }))
    expect(await screen.findByText('Recipe added.')).toBeInTheDocument()
  })
})
