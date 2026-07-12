import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NoticeProvider } from '../../components/ui'
import Nutrition from './Nutrition'
import { supabase } from '../../lib/supabase'

// These child modals run their own useQuery(supabase...) on mount even while
// closed. Stub them out so this test file only has to model the 'recipes' /
// 'recipe_ingredients' tables that RecipesTab itself touches.
vi.mock('./RecipeImportModal', () => ({ default: () => null }))
vi.mock('./RecipePhotoUploadModal', () => ({ default: () => null }))
vi.mock('../../lib/storage', () => ({ uploadRecipePhoto: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn() } }))

function buildRecipesTable(insertResult: { data: unknown; error: unknown } = { data: { id: 'recipe-1' }, error: null }) {
  const single = vi.fn().mockResolvedValue(insertResult)
  const insertSelect = vi.fn().mockReturnValue({ single })
  const insert = vi.fn().mockReturnValue({ select: insertSelect })
  const order = vi.fn().mockResolvedValue({ data: [], error: null })
  const listSelect = vi.fn().mockReturnValue({ order })
  return { select: listSelect, insert }
}

function buildIngredientsTable() {
  return { insert: vi.fn().mockResolvedValue({ error: null }) }
}

function setupSupabase() {
  const recipesTable = buildRecipesTable()
  const ingredientsTable = buildIngredientsTable()
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'recipes') return recipesTable as never
    if (table === 'recipe_ingredients') return ingredientsTable as never
    throw new Error(`Unexpected table in test: ${table}`)
  })
  return { recipesTable, ingredientsTable }
}

function renderNutrition() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <NoticeProvider>
        <MemoryRouter initialEntries={['/admin/nutrition']}>
          <Nutrition />
        </MemoryRouter>
      </NoticeProvider>
    </QueryClientProvider>
  )
}

// Ingredient/food Input fields in this file render a plain sibling
// `<label>`/`<input>` pair with no `id`, so `getByLabelText` can't associate
// them. Walk from the label's wrapper div to its input instead.
function getInputByLabelText(text: string): HTMLInputElement {
  const label = screen.getAllByText(text).find(el => el.tagName === 'LABEL')
  if (!label?.parentElement) throw new Error(`No labeled input found for "${text}"`)
  const input = label.parentElement.querySelector('input')
  if (!input) throw new Error(`No input found for label "${text}"`)
  return input
}

describe('Nutrition — recipe ingredient validation', () => {
  afterEach(() => cleanup())

  it('blocks saving and shows an inline error when an ingredient row has data but no name', async () => {
    const { recipesTable, ingredientsTable } = setupSupabase()
    renderNutrition()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '+ Add recipe' }))
    await user.type(screen.getByPlaceholderText('e.g. Overnight Oats'), 'Overnight Oats')

    // Fill in macro data for the first ingredient row but leave its name blank.
    const caloriesInput = getInputByLabelText('Calories')
    await user.clear(caloriesInput)
    await user.type(caloriesInput, '120')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Row 1 has a quantity or macro value but no name. Give it a name or clear its values before saving.'
    )

    const dialog = screen.getByRole('dialog')
    const saveButton = within(dialog).getByRole('button', { name: 'Add recipe' })
    expect(saveButton).toBeDisabled()

    // Even if something tried to trigger the save anyway, no data should reach Supabase.
    await user.click(saveButton)
    expect(recipesTable.insert).not.toHaveBeenCalled()
    expect(ingredientsTable.insert).not.toHaveBeenCalled()
  })

  it('saves macros that match the on-screen total and drops only the truly empty row', async () => {
    const { recipesTable, ingredientsTable } = setupSupabase()
    renderNutrition()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '+ Add recipe' }))
    await user.type(screen.getByPlaceholderText('e.g. Overnight Oats'), 'Overnight Oats')

    await user.type(getInputByLabelText('Name'), 'Oats')
    const caloriesInput = getInputByLabelText('Calories')
    await user.clear(caloriesInput)
    await user.type(caloriesInput, '300')
    const proteinInput = getInputByLabelText('Protein')
    await user.clear(proteinInput)
    await user.type(proteinInput, '10')

    // Add a second, genuinely empty row (no name, no data) — this one is fine to drop.
    await user.click(screen.getByRole('button', { name: '+ Add ingredient' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('300 kcal')).toBeInTheDocument()

    const dialog = screen.getByRole('dialog')
    const saveButton = within(dialog).getByRole('button', { name: 'Add recipe' })
    expect(saveButton).not.toBeDisabled()
    await user.click(saveButton)

    await waitFor(() => expect(recipesTable.insert).toHaveBeenCalled())
    expect(recipesTable.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Overnight Oats', calories: 300, protein_g: 10, carbs_g: 0, fat_g: 0 })
    )

    await waitFor(() => expect(ingredientsTable.insert).toHaveBeenCalled())
    const insertedIngredients = ingredientsTable.insert.mock.calls[0][0] as Array<{ name: string }>
    expect(insertedIngredients).toHaveLength(1)
    expect(insertedIngredients[0]).toMatchObject({ name: 'Oats', calories: 300, protein_g: 10 })
  })
})
