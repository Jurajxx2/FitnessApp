import { describe, it, expect, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ExercisePicker } from './ExercisePicker'

const EXERCISE_ROW = {
  id: 'ex-1',
  name_en: 'Bench Press',
  name_cs: 'Bench Press',
  category_id: null,
  image_url: null,
  image_url_2: null,
  difficulty: null,
  primary_muscles: ['chest'],
  equipment_names: [],
}

let capturedOrderCalls: Array<[string, unknown]> = []

// Generic Postgrest-like builder for the 'exercises' table. Captures every .order() call
// (column + options), so the ordering the picker's paginated list query issues can be
// asserted directly. .range() is what distinguishes that paginated query from the
// equipment-options query (which shares the same table but only calls .limit()) — only
// the former resolves with a row, keeping the latter a harmless empty no-op.
function createExercisesBuilder() {
  let paginated = false
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    order: (column: string, options?: unknown) => {
      capturedOrderCalls.push([column, options])
      return builder
    },
    limit: () => builder,
    range: () => {
      paginated = true
      return builder
    },
    overlaps: () => builder,
    in: () => builder,
    textSearch: () => builder,
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

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => (table === 'exercises' ? createExercisesBuilder() : createEmptyBuilder()),
  },
}))

function renderPicker() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ExercisePicker locale="sk" selectedIds={[]} onAdd={() => {}} />
    </QueryClientProvider>
  )
}

describe('ExercisePicker exercise list ordering', () => {
  it('orders by name_en with a secondary id tie-break, so offset pagination over the non-unique name cannot skip or duplicate rows', async () => {
    renderPicker()

    await waitFor(() => expect(capturedOrderCalls.length).toBeGreaterThan(0))

    expect(capturedOrderCalls).toEqual([
      ['name_en', undefined],
      ['id', undefined],
    ])
  })
})
