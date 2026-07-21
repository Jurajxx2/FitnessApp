import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Plus, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Difficulty, ExerciseCategory } from '../types/database'
import { Chip } from './ui'
import { ExerciseThumbnail } from './ExerciseThumbnail'

export interface ExercisePickerItem {
  id: string
  name_en: string
  name_cs: string | null
  category_id: number | null
  image_url: string | null
  image_url_2: string | null
  difficulty: Difficulty | null
  primary_muscles: string[]
  equipment_names: string[]
}

interface ExercisePickerProps {
  locale: 'en' | 'sk'
  selectedIds: string[]
  onAdd: (exercise: ExercisePickerItem) => void
}

const PAGE_SIZE = 24

const COPY = {
  en: {
    search: 'Search exercises…', all: 'All', equipment: 'All equipment', difficulty: 'All levels',
    beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', empty: 'No exercises match these filters.',
    error: 'Exercises could not be loaded.', added: 'Added', add: 'Add', previous: 'Previous page', next: 'Next page', of: 'of',
  },
  sk: {
    search: 'Hľadať cviky…', all: 'Všetky', equipment: 'Všetko vybavenie', difficulty: 'Všetky úrovne',
    beginner: 'Začiatočník', intermediate: 'Stredne pokročilý', advanced: 'Pokročilý', empty: 'Žiadne cviky nezodpovedajú filtrom.',
    error: 'Cviky sa nepodarilo načítať.', added: 'Pridané', add: 'Pridať', previous: 'Predchádzajúca strana', next: 'Ďalšia strana', of: 'z',
  },
} as const

function useCategories() {
  return useQuery<ExerciseCategory[]>({
    queryKey: ['exercise-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('exercise_categories').select('id, name').order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

function useEquipmentOptions() {
  return useQuery<string[]>({
    queryKey: ['exercise-equipment-options'],
    queryFn: async () => {
      const { data, error } = await supabase.from('exercises').select('equipment_names').eq('is_active', true).limit(1000)
      if (error) throw error
      return [...new Set((data ?? []).flatMap(row => row.equipment_names ?? []))].sort((a, b) => a.localeCompare(b))
    },
  })
}

function usePickerExercises(search: string, categoryId: number | null, equipment: string, difficulty: string, page: number) {
  return useQuery<{ data: ExercisePickerItem[]; count: number }>({
    queryKey: ['exercise-picker', search, categoryId, equipment, difficulty, page],
    queryFn: async () => {
      let query = supabase
        .from('exercises')
        .select('id, name_en, name_cs, category_id, image_url, image_url_2, difficulty, primary_muscles, equipment_names', { count: 'exact' })
        .eq('is_active', true)
        .order('name_en')
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (search) query = query.textSearch('search_vector', search, { type: 'websearch', config: 'simple' })
      if (categoryId !== null) query = query.eq('category_id', categoryId)
      if (equipment) query = query.contains('equipment_names', [equipment])
      if (difficulty) query = query.eq('difficulty', difficulty)
      const { data, count, error } = await query
      if (error) throw error
      return { data: (data ?? []) as ExercisePickerItem[], count: count ?? 0 }
    },
  })
}

export function ExercisePicker({ locale, selectedIds, onAdd }: ExercisePickerProps) {
  const copy = COPY[locale]
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [equipment, setEquipment] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [page, setPage] = useState(0)
  const categoriesQuery = useCategories()
  const equipmentQuery = useEquipmentOptions()
  const exercisesQuery = usePickerExercises(debouncedSearch, categoryId, equipment, difficulty, page)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(0)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  const selected = useMemo(() => new Set(selectedIds), [selectedIds])
  const exercises = exercisesQuery.data?.data ?? []
  const count = exercisesQuery.data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  function resetPage<T>(setter: (value: T) => void, value: T) {
    setter(value)
    setPage(0)
  }

  return (
    <div>
      <label className="relative block">
        <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <span className="sr-only">{copy.search}</span>
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder={copy.search} className="h-11 w-full rounded-xl border border-outline bg-surface pl-10 pr-3 text-sm text-text-primary outline-none focus:border-accent" />
      </label>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <Chip size="sm" variant="accent" selected={categoryId === null} onClick={() => resetPage(setCategoryId, null)}>{copy.all}</Chip>
        {(categoriesQuery.data ?? []).map(category => (
          <Chip key={category.id} size="sm" variant="accent" selected={categoryId === category.id} onClick={() => resetPage(setCategoryId, category.id)} className="whitespace-nowrap">
            {category.name}
          </Chip>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label>
          <span className="sr-only">{copy.equipment}</span>
          <select value={equipment} onChange={event => resetPage(setEquipment, event.target.value)} className="h-10 w-full rounded-xl border border-outline bg-surface px-3 text-sm text-text-primary">
            <option value="">{copy.equipment}</option>
            {(equipmentQuery.data ?? []).map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">{copy.difficulty}</span>
          <select value={difficulty} onChange={event => resetPage(setDifficulty, event.target.value)} className="h-10 w-full rounded-xl border border-outline bg-surface px-3 text-sm text-text-primary">
            <option value="">{copy.difficulty}</option>
            {(['beginner', 'intermediate', 'advanced'] as Difficulty[]).map(option => <option key={option} value={option}>{copy[option]}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-4 flex min-h-32 flex-col gap-2" aria-live="polite">
        {exercisesQuery.isLoading ? (
          Array.from({ length: 5 }, (_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-surface-highest" />)
        ) : exercisesQuery.isError ? (
          <p className="rounded-xl border border-error/30 bg-error/10 p-4 text-sm text-error">{copy.error}</p>
        ) : exercises.length === 0 ? (
          <p className="rounded-xl border border-dashed border-outline p-5 text-sm text-text-secondary">{copy.empty}</p>
        ) : exercises.map(exercise => {
          const isAdded = selected.has(exercise.id)
          const name = locale === 'sk' ? exercise.name_cs || exercise.name_en : exercise.name_en
          const meta = [exercise.primary_muscles[0], exercise.equipment_names[0]].filter(Boolean).join(' · ')
          return (
            <button key={exercise.id} type="button" aria-label={`${isAdded ? copy.added : copy.add} ${name}`} onClick={() => !isAdded && onAdd(exercise)} disabled={isAdded} className="flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-xl border border-outline-subtle bg-surface p-2.5 text-left transition-colors hover:bg-surface-highest disabled:cursor-default disabled:opacity-65">
              <ExerciseThumbnail imageUrl={exercise.image_url} imageUrl2={exercise.image_url_2} name={name} className="h-11 w-11 flex-shrink-0 rounded-lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-text-primary">{name}</span>
                {meta && <span className="mt-0.5 block truncate text-xs text-text-secondary">{meta}</span>}
              </span>
              <span className={`inline-flex flex-shrink-0 items-center gap-1 text-xs font-semibold ${isAdded ? 'text-success' : 'text-accent'}`}>
                {isAdded ? <Check size={15} /> : <Plus size={15} />} {isAdded ? copy.added : copy.add}
              </span>
            </button>
          )
        })}
      </div>

      {count > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between border-t border-outline pt-4">
          <span className="text-xs text-text-secondary">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, count)} {copy.of} {count}</span>
          <div className="flex gap-2">
            <button type="button" aria-label={copy.previous} onClick={() => setPage(current => Math.max(0, current - 1))} disabled={page === 0} className="min-h-9 cursor-pointer rounded-lg border border-outline bg-surface px-3 text-sm text-text-secondary disabled:opacity-40">←</button>
            <button type="button" aria-label={copy.next} onClick={() => setPage(current => Math.min(totalPages - 1, current + 1))} disabled={page >= totalPages - 1} className="min-h-9 cursor-pointer rounded-lg border border-outline bg-surface px-3 text-sm text-text-secondary disabled:opacity-40">→</button>
          </div>
        </div>
      )}
    </div>
  )
}
