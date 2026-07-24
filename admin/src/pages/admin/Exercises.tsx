import { useDeferredValue, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, DataTable, EmptyState, PageHeader, SearchInput, useNotice } from '../../components/ui'
import type { ActionMenuItem, BulkAction, DataColumn } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import type { Exercise, ExerciseCategory } from '../../types/database'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

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
  const [bulkBusy, setBulkBusy] = useState(false)

  const { data: { data: exercises = [], count: totalCount = 0 } = {}, isLoading, isError } = useExercises(deferredSearch, filterCategory, activeOnly, page, pageSize)
  const { data: categories = [] } = useCategories()

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean; silent?: boolean }) => {
      const { error } = await supabase.from('exercises').update({ is_active: isActive }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['exercises-admin'] })
      if (!variables.silent) notify(variables.isActive ? 'Exercise is now active.' : 'Exercise hidden from athletes.')
    },
    onError: (error, variables) => { if (!variables.silent) notify(`Couldn’t update exercise: ${error.message}`, 'error') },
  })

  function updateSearch(value: string) {
    setSearch(value)
    setPage(0)
  }

  const columns: DataColumn<Exercise>[] = [
    {
      key: 'exercise',
      header: 'Exercise',
      render: exercise => (
        <div className="flex items-center gap-3">
          {exercise.image_url ? <img src={exercise.image_url} alt="" className="h-10 w-10 flex-shrink-0 rounded-xl object-cover" /> : <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-surface-highest" />}
          <div className="min-w-0">
            <p className="truncate font-semibold text-text-primary">{exercise.name_en}</p>
            {exercise.name_cs && <p className="truncate text-xs text-text-secondary">{exercise.name_cs}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: exercise => categories.find(category => category.id === exercise.category_id)?.name ?? '—',
    },
    {
      key: 'difficulty',
      header: 'Difficulty',
      className: 'capitalize',
      render: exercise => exercise.difficulty ?? '—',
    },
    {
      key: 'visibility',
      header: 'Visibility',
      render: exercise => (
        <button
          type="button"
          onClick={() => toggleActive.mutate({ id: exercise.id, isActive: !exercise.is_active })}
          disabled={toggleActive.isPending}
          className={`min-h-9 cursor-pointer rounded-full border px-3 text-xs font-semibold ${exercise.is_active ? 'border-success/30 bg-success/10 text-success' : 'border-outline bg-surface text-text-secondary'}`}
        >
          {exercise.is_active ? 'Active' : 'Hidden'}
        </button>
      ),
    },
  ]

  const rowActions = (exercise: Exercise): ActionMenuItem[] => [
    { key: 'open', label: 'Open', onSelect: () => navigate(`/admin/exercises/${exercise.id}`) },
  ]

  const bulkActions = (selected: Exercise[]): BulkAction[] => {
    const anyHidden = selected.some(exercise => !exercise.is_active)
    return [
      {
        key: 'toggle',
        label: anyHidden ? 'Show' : 'Hide',
        icon: anyHidden ? <Eye size={16} /> : <EyeOff size={16} />,
        disabled: bulkBusy,
        onClick: async () => {
          setBulkBusy(true)
          try {
            await Promise.all(selected.map(exercise => toggleActive.mutateAsync({ id: exercise.id, isActive: anyHidden, silent: true })))
            notify(anyHidden ? 'Exercises shown.' : 'Exercises hidden.')
          } catch (error) {
            notify(`Couldn’t update exercises: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
          } finally {
            setBulkBusy(false)
          }
        },
      },
    ]
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Exercises"
        description="Maintain the exercise library used by workout plans and athlete substitutions."
        actions={<Button onClick={() => navigate('/admin/exercises/new')}>Add exercise</Button>}
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

      {isError ? (
        <EmptyState title="Exercises couldn’t be loaded" description="Refresh the page to retry." />
      ) : (
        <DataTable<Exercise>
          rows={exercises}
          getRowId={exercise => exercise.id}
          columns={columns}
          rowLabel={exercise => `Open ${exercise.name_en}`}
          onRowActivate={exercise => navigate(`/admin/exercises/${exercise.id}`)}
          rowActions={rowActions}
          selectable
          bulkActions={bulkActions}
          serverPagination
          page={page}
          pageSize={pageSize}
          totalItems={totalCount}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={setPage}
          onPageSizeChange={size => { setPageSize(size); setPage(0) }}
          loading={isLoading}
          empty={
            <EmptyState
              title={search || filterCategory !== null || activeOnly !== null ? 'No exercises match these filters' : 'No exercises in the library yet'}
              description={search || filterCategory !== null || activeOnly !== null ? 'Try a different name, category, or visibility.' : 'Add the first exercise manually.'}
              action={search || filterCategory !== null || activeOnly !== null ? undefined : <Button onClick={() => navigate('/admin/exercises/new')}>Add exercise</Button>}
            />
          }
        />
      )}
    </div>
  )
}
