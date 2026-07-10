import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { SlideOver } from './ui'
import type { Exercise, ExerciseCategory } from '../types/database'

type ExerciseResult = Pick<Exercise, 'id' | 'name_en' | 'primary_muscles' | 'image_url' | 'category_id'>

const PAGE_SIZE = 25

interface ExerciseBrowserSlideOverProps {
  open: boolean
  onClose: () => void
  addedNames: string[]
  onAdd: (name: string, muscleGroup: string, exerciseId: string) => void
}

function useCategories() {
  return useQuery<ExerciseCategory[]>({
    queryKey: ['exercise-categories'],
    queryFn: async () => {
      const { data } = await supabase.from('exercise_categories').select('*').order('name')
      return data ?? []
    },
  })
}

function useBrowserExercises(search: string, categoryId: number | null, page: number) {
  return useQuery<{ data: ExerciseResult[]; count: number }>({
    queryKey: ['exercises-browser', search, categoryId, page],
    queryFn: async () => {
      let q = supabase
        .from('exercises')
        .select('id, name_en, primary_muscles, image_url, category_id', { count: 'exact' })
        .eq('is_active', true)
        .order('name_en')
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (search) q = q.ilike('name_en', `%${search}%`)
      if (categoryId !== null) q = q.eq('category_id', categoryId)
      const { data, count } = await q
      return { data: data ?? [], count: count ?? 0 }
    },
  })
}

export function ExerciseBrowserSlideOver({ open, onClose, addedNames, onAdd }: ExerciseBrowserSlideOverProps) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  const { data: categories = [] } = useCategories()
  const { data: { data: exercises = [], count = 0 } = {} } = useBrowserExercises(debouncedSearch, categoryId, page)
  const totalPages = Math.ceil(count / PAGE_SIZE)

  function handleSearch(value: string) {
    setSearch(value)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => { setDebouncedSearch(value); setPage(0) }, 300)
  }

  function handleCategory(id: number | null) {
    setCategoryId(id)
    setPage(0)
  }

  const chipClass = (active: boolean) =>
    `cursor-pointer rounded-full border px-3 py-1 text-xs ${
      active
        ? 'border-transparent bg-accent text-on-accent'
        : 'border-outline bg-surface text-text-secondary hover:bg-surface-elevated'
    }`

  return (
    <SlideOver open={open} onClose={onClose} title="Browse Exercises">
      <div className="mb-3">
        <input
          className="h-10 w-full rounded-xl border border-outline bg-surface px-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-secondary focus:border-accent"
          placeholder="Search exercises…"
          value={search}
          onChange={e => handleSearch(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button type="button" onClick={() => handleCategory(null)} className={chipClass(categoryId === null)}>All</button>
        {categories.map(c => (
          <button key={c.id} type="button" onClick={() => handleCategory(c.id)} className={chipClass(categoryId === c.id)}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        {exercises.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-secondary">No exercises found</p>
        ) : exercises.map(ex => {
          const isAdded = addedNames.includes(ex.name_en)
          return (
            <div key={ex.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-highest">
              {ex.image_url ? (
                <img src={ex.image_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
              ) : (
                <div className="h-8 w-8 flex-shrink-0 rounded bg-surface" />
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium text-text-primary">{ex.name_en}</div>
                {ex.primary_muscles?.[0] && (
                  <div className="truncate text-xs text-text-secondary">{ex.primary_muscles[0]}</div>
                )}
              </div>
              {isAdded ? (
                <span className="flex-shrink-0 text-xs text-success">✓ added</span>
              ) : (
                <button
                  type="button"
                  aria-label={`Add ${ex.name_en}`}
                  onClick={() => onAdd(ex.name_en, ex.primary_muscles?.[0] ?? '', ex.id)}
                  className="flex-shrink-0 cursor-pointer border-0 bg-transparent text-lg leading-none text-accent hover:text-text-primary"
                >
                  ＋
                </button>
              )}
            </div>
          )
        })}
      </div>

      {count > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between border-t border-outline pt-4">
          <span className="text-xs text-text-secondary">
            {page * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE + PAGE_SIZE, count)} of {count}
          </span>
          <div className="flex gap-1">
            <button type="button" onClick={() => setPage(p => p - 1)} disabled={page === 0}
              className="cursor-pointer rounded border border-outline bg-surface px-2 py-1 text-xs text-text-secondary hover:text-text-primary disabled:opacity-40">
              ←
            </button>
            <button type="button" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
              className="cursor-pointer rounded border border-outline bg-surface px-2 py-1 text-xs text-text-secondary hover:text-text-primary disabled:opacity-40">
              →
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-end mt-6">
        <button type="button" onClick={onClose}
          className="cursor-pointer rounded-xl border-0 bg-accent px-4 py-2 text-sm text-on-accent hover:opacity-90">
          Done
        </button>
      </div>
    </SlideOver>
  )
}
