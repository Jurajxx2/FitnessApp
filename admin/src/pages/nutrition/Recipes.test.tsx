import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Recipes from './Recipes'
import { useFavorites, useRecipes } from '../../nutrition/hooks'
import { useToggleFavorite } from '../../nutrition/mutations'
import type { RecipeRow } from '../../types/database'

vi.mock('../../nutrition/hooks', () => ({
  useRecipes: vi.fn(),
  useFavorites: vi.fn(),
}))
vi.mock('../../nutrition/mutations', () => ({
  useToggleFavorite: vi.fn(),
}))

const mockUseRecipes = vi.mocked(useRecipes)
const mockUseFavorites = vi.mocked(useFavorites)
const mockUseToggleFavorite = vi.mocked(useToggleFavorite)

const RECIPE: RecipeRow = {
  id: 'recipe-1',
  name: 'Ryžová miska',
  description: null,
  calories: 420,
  protein_g: 30,
  carbs_g: 45,
  fat_g: 12,
  photo_url: null,
  prep_time_min: null,
  cook_time_min: null,
  servings: 1,
  difficulty: null,
  tags: [],
  featured: false,
  is_active: true,
}

function renderPage() {
  render(
    <MemoryRouter>
      <Recipes />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseFavorites.mockReturnValue({ data: new Set() } as unknown as ReturnType<typeof useFavorites>)
  mockUseToggleFavorite.mockReturnValue({ mutate: vi.fn() } as unknown as ReturnType<typeof useToggleFavorite>)
})
afterEach(() => cleanup())

describe('Recipes', () => {
  it('keeps the header and search input mounted while the recipe query is loading', () => {
    // Regression test for the unmount bug: with isLoading true (the state a fresh
    // search/page query key produces before placeholderData ever kicks in), the search
    // box and page chrome above the results must still be in the document — not
    // replaced wholesale by the loading skeleton.
    mockUseRecipes.mockReturnValue({ data: undefined, isLoading: true, isFetching: true } as unknown as ReturnType<typeof useRecipes>)

    renderPage()

    expect(screen.getByText('Recepty')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Hľadať recepty…')).toBeInTheDocument()
  })

  it('does not lose focus in the search input while a query is in flight', () => {
    mockUseRecipes.mockReturnValue({ data: { data: [RECIPE], count: 1 }, isLoading: true, isFetching: true } as unknown as ReturnType<typeof useRecipes>)
    renderPage()

    const input = screen.getByPlaceholderText('Hľadať recepty…')
    fireEvent.change(input, { target: { value: 'ryza' } })

    expect(document.body.contains(input)).toBe(true)
    expect(screen.getByPlaceholderText('Hľadať recepty…')).toHaveValue('ryza')
  })

  it('renders recipes once loaded', () => {
    mockUseRecipes.mockReturnValue({ data: { data: [RECIPE], count: 1 }, isLoading: false, isFetching: false } as unknown as ReturnType<typeof useRecipes>)
    renderPage()

    expect(screen.getByText('Ryžová miska')).toBeInTheDocument()
  })
})
