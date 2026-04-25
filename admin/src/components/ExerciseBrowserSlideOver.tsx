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
  onAdd: (name: string, muscleGroup: string) => void
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
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>()

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
    `text-xs px-3 py-1 rounded-full border cursor-pointer bg-transparent ${
      active
        ? 'bg-[var(--primary)] text-white border-transparent'
        : 'text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--text-muted)]'
    }`

  return (
    <SlideOver open={open} onClose={onClose} title="Browse Exercises">
      <div className="mb-3">
        <input
          className="w-full bg-[var(--input-bg)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-disabled)] outline-none focus:border-[var(--text-muted)] transition-colors"
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
          <p className="text-sm text-[var(--text-disabled)] text-center py-8">No exercises found</p>
        ) : exercises.map(ex => {
          const isAdded = addedNames.includes(ex.name_en)
          return (
            <div key={ex.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-[var(--bg-card-hover)]">
              {ex.image_url ? (
                <img src={ex.image_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded bg-[var(--bg)] flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[var(--text)] font-medium truncate">{ex.name_en}</div>
                {ex.primary_muscles?.[0] && (
                  <div className="text-xs text-[var(--text-muted)] truncate">{ex.primary_muscles[0]}</div>
                )}
              </div>
              {isAdded ? (
                <span className="text-xs text-green-400 flex-shrink-0">✓ added</span>
              ) : (
                <button
                  type="button"
                  aria-label={`Add ${ex.name_en}`}
                  onClick={() => onAdd(ex.name_en, ex.primary_muscles?.[0] ?? '')}
                  className="text-lg text-[var(--primary,#7c6af7)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer flex-shrink-0 leading-none"
                >
                  ＋
                </button>
              )}
            </div>
          )
        })}
      </div>

      {count > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border)]">
          <span className="text-xs text-[var(--text-muted)]">
            {page * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE + PAGE_SIZE, count)} of {count}
          </span>
          <div className="flex gap-1">
            <button type="button" onClick={() => setPage(p => p - 1)} disabled={page === 0}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40 px-2 py-1 border border-[var(--border)] rounded bg-transparent cursor-pointer">
              ←
            </button>
            <button type="button" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40 px-2 py-1 border border-[var(--border)] rounded bg-transparent cursor-pointer">
              →
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-end mt-6">
        <button type="button" onClick={onClose}
          className="text-sm bg-[var(--primary,#7c6af7)] text-white rounded-md px-4 py-2 cursor-pointer border-0 hover:opacity-90">
          Done
        </button>
      </div>
    </SlideOver>
  )
}
