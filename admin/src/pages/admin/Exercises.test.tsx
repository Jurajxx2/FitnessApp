import { describe, it, expect, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Exercises from './Exercises'

const EXERCISE_ROW = {
  id: 'ex-1',
  name_en: 'Bench Press',
  name_cs: null,
  category_id: null,
  difficulty: 'beginner',
  image_url: null,
  is_active: true,
}

let capturedOrderCalls: Array<[string, unknown]> = []

// Generic Postgrest-like builder for the 'exercises' table. Captures every .order() call
// so the admin list query's ordering can be asserted directly; resolves with one row once
// .range() runs (the page's server-paginated read).
function createExercisesBuilder() {
  let paginated = false
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    ilike: () => builder,
    order: (column: string, options?: unknown) => {
      capturedOrderCalls.push([column, options])
      return builder
    },
    range: () => {
      paginated = true
      return builder
    },
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(paginated ? { data: [EXERCISE_ROW], count: 1, error: null } : { data: [], count: 0, error: null }).then(resolve, reject),
  }
  return builder
}

// Covers exercise_categories: just needs to resolve to an empty list.
function createEmptyBuilder() {
  const result = { data: [], count: 0, error: null }
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    then: (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return builder
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => (table === 'exercises' ? createExercisesBuilder() : createEmptyBuilder()),
  },
}))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/exercises']}>
        <Exercises />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('admin Exercises list ordering', () => {
  it('orders by name_en with a secondary id tie-break, so offset pagination over the non-unique name cannot skip or duplicate rows', async () => {
    renderPage()

    await waitFor(() => expect(capturedOrderCalls.length).toBeGreaterThan(0))

    expect(capturedOrderCalls).toEqual([
      ['name_en', undefined],
      ['id', undefined],
    ])
  })
})
