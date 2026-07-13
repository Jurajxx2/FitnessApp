import { useDeferredValue, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button, ClickableRow, EmptyState, PageHeader, SearchInput, Table, Td, Th, useNotice } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import type { Exercise, ExerciseCategory } from '../../types/database'
import ImportExercisesModal from './ImportExercisesModal'

const PAGE_SIZE_OPTIONS = [25, 50, 100]

function useExercises(search: string, categoryId: number | null, activeOnly: boolean | null, page: number, pageSize: number) {
  return useQuery<{ data: Exercise[]; count: number }>({
    queryKey: ['exercises-admin', search, categoryId, activeOnly, page, pageSize],
    queryFn: async () => {
      let query = supabase
        .from('exercises')
        .select('*', { count: 'exact' })
        .order('name_en')
        .range(page * pageSize, page * pageSize + pageSize - 1)
      if (search) query = query.ilike('name_en', `%${search}%`)
      if (categoryId !== null) query = query.eq('category_id', categoryId)
      if (activeOnly !== null) query = query.eq('is_active', activeOnly)
      const { data, count, error } = await query
      if (error) throw error
      return { data: data ?? [], count: count ?? 0 }
    },
  })
}

function useCategories() {
  return useQuery<ExerciseCategory[]>({
    queryKey: ['exercise-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('exercise_categories').select('*').order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

export default function Exercises() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify } = useNotice()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [filterCategory, setFilterCategory] = useState<number | null>(null)
  const [activeOnly, setActiveOnly] = useState<boolean | null>(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [importModalOpen, setImportModalOpen] = useState(false)

  const { data: { data: exercises = [], count: totalCount = 0 } = {}, isLoading, isError } = useExercises(deferredSearch, filterCategory, activeOnly, page, pageSize)
  const { data: categories = [] } = useCategories()
  const totalPages = Math.ceil(totalCount / pageSize)

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from('exercises').update({ is_active: isActive }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['exercises-admin'] })
      notify(variables.isActive ? 'Exercise is now active.' : 'Exercise hidden from athletes.')
    },
    onError: error => notify(`Couldn’t update exercise: ${error.message}`, 'error'),
  })

  function updateSearch(value: string) {
    setSearch(value)
    setPage(0)
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Exercises"
        description="Maintain the exercise library used by workout plans and athlete substitutions."
        actions={
          <>
            <Button variant="ghost" onClick={() => setImportModalOpen(true)}>Sync library</Button>
            <Button onClick={() => navigate('/admin/exercises/new')}>Add exercise</Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <SearchInput
          placeholder="Search by name…"
          value={search}
          onChange={event => updateSearch(event.target.value)}
          onClear={() => updateSearch('')}
          className="w-full sm:w-64"
        />
        <select
          aria-label="Filter exercise category"
          className="h-10 w-full rounded-xl border border-outline bg-surface px-3 text-sm text-text-primary outline-none focus:border-accent sm:w-auto"
          value={filterCategory ?? ''}
          onChange={event => { setFilterCategory(event.target.value ? Number(event.target.value) : null); setPage(0) }}
        >
          <option value="">All categories</option>
          {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <select
          aria-label="Filter exercise visibility"
          className="h-10 w-full rounded-xl border border-outline bg-surface px-3 text-sm text-text-primary outline-none focus:border-accent sm:w-auto"
          value={activeOnly === null ? '' : String(activeOnly)}
          onChange={event => { setActiveOnly(event.target.value === '' ? null : event.target.value === 'true'); setPage(0) }}
        >
          <option value="">All visibility</option>
          <option value="true">Active</option>
          <option value="false">Hidden</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : isError ? (
        <EmptyState title="Exercises couldn’t be loaded" description="Refresh the page to retry." />
      ) : exercises.length === 0 ? (
        <EmptyState
          title={search || filterCategory !== null || activeOnly !== null ? 'No exercises match these filters' : 'No exercises in the library yet'}
          description={search || filterCategory !== null || activeOnly !== null ? 'Try a different name, category, or visibility.' : 'Add an exercise or sync a trusted exercise library.'}
          action={search || filterCategory !== null || activeOnly !== null ? undefined : <Button onClick={() => navigate('/admin/exercises/new')}>Add exercise</Button>}
        />
      ) : (
        <Table>
          <thead>
            <tr><Th>Exercise</Th><Th>Category</Th><Th>Difficulty</Th><Th>Visibility</Th><Th><span className="sr-only">Actions</span></Th></tr>
          </thead>
          <tbody>
            {exercises.map(exercise => (
              <ClickableRow key={exercise.id} label={`Open ${exercise.name_en}`} onActivate={() => navigate(`/admin/exercises/${exercise.id}`)}>
                <Td>
                  <div className="flex items-center gap-3">
                    {exercise.image_url ? <img src={exercise.image_url} alt="" className="h-10 w-10 flex-shrink-0 rounded-xl object-cover" /> : <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-surface-highest" />}
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-text-primary">{exercise.name_en}</p>
                      {exercise.name_cs && <p className="truncate text-xs text-text-secondary">{exercise.name_cs}</p>}
                    </div>
                  </div>
                </Td>
                <Td>{categories.find(category => category.id === exercise.category_id)?.name ?? '—'}</Td>
                <Td className="capitalize">{exercise.difficulty ?? '—'}</Td>
                <Td>
                  <button
                    type="button"
                    onClick={() => toggleActive.mutate({ id: exercise.id, isActive: !exercise.is_active })}
                    disabled={toggleActive.isPending}
                    className={`min-h-9 cursor-pointer rounded-full border px-3 text-xs font-semibold ${exercise.is_active ? 'border-success/30 bg-success/10 text-success' : 'border-outline bg-surface text-text-secondary'}`}
                  >
                    {exercise.is_active ? 'Active' : 'Hidden'}
                  </button>
                </Td>
                <Td><Button variant="ghost" className="min-h-9" onClick={() => navigate(`/admin/exercises/${exercise.id}`)}>Open</Button></Td>
              </ClickableRow>
            ))}
          </tbody>
        </Table>
      )}

      {!isLoading && totalCount > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-text-secondary">
          <label className="flex items-center gap-2">
            Rows per page
            <select
              className="rounded-lg border border-outline bg-surface px-2 py-1 text-text-primary"
              value={pageSize}
              onChange={event => { setPageSize(Number(event.target.value)); setPage(0) }}
            >
              {PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-3">
            <span>{page * pageSize + 1}–{Math.min(page * pageSize + pageSize, totalCount)} of {totalCount}</span>
            <Button variant="ghost" className="min-h-9 px-3" onClick={() => setPage(current => current - 1)} disabled={page === 0}>Previous</Button>
            <Button variant="ghost" className="min-h-9 px-3" onClick={() => setPage(current => current + 1)} disabled={page >= totalPages - 1}>Next</Button>
          </div>
        </div>
      )}

      <ImportExercisesModal open={importModalOpen} onClose={() => setImportModalOpen(false)} />
    </div>
  )
}
