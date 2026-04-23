# Workout Exercise Picker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins pick exercises from the database when building workout plans, via inline autocomplete on the name field and a full browse slide-over panel.

**Architecture:** Two new components (`ExerciseCombobox`, `ExerciseBrowserSlideOver`) slot into the existing `Workouts.tsx` exercise editor. No database schema changes — the picker pre-fills `name` and `muscle_group` fields; sets/reps/rest are preserved or defaulted. `ExerciseCombobox` uses a `createPortal` dropdown to escape the modal's scroll container. `ExerciseBrowserSlideOver` wraps the existing `SlideOver` UI component.

**Tech Stack:** React 18, @tanstack/react-query, Supabase JS, Tailwind CSS with CSS variables, Vitest + @testing-library/react

---

### Task 1: ExerciseCombobox component

**Files:**
- Create: `admin/src/components/ExerciseCombobox.tsx`
- Create: `admin/src/components/ExerciseCombobox.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `admin/src/components/ExerciseCombobox.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ExerciseCombobox } from './ExerciseCombobox'

const mockResults = [
  { id: '1', name_en: 'Bench Press', primary_muscles: ['Chest'], image_url: null },
  { id: '2', name_en: 'Incline Bench Press', primary_muscles: ['Chest'], image_url: null },
]

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockResults }),
    }),
  },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('ExerciseCombobox', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders an input with placeholder', () => {
    render(<ExerciseCombobox value="" onChange={vi.fn()} />, { wrapper })
    expect(screen.getByPlaceholderText('e.g. Bench Press')).toBeDefined()
  })

  it('calls onChange with text and empty muscle group on free text input', () => {
    const onChange = vi.fn()
    render(<ExerciseCombobox value="" onChange={onChange} />, { wrapper })
    fireEvent.change(screen.getByPlaceholderText('e.g. Bench Press'), { target: { value: 'squat' } })
    expect(onChange).toHaveBeenCalledWith('squat', '')
  })

  it('shows dropdown results after typing 2+ characters', async () => {
    vi.useFakeTimers()
    render(<ExerciseCombobox value="" onChange={vi.fn()} />, { wrapper })
    fireEvent.change(screen.getByPlaceholderText('e.g. Bench Press'), { target: { value: 'bench' } })
    vi.advanceTimersByTime(250)
    await waitFor(() => expect(screen.queryByText('Bench Press')).toBeDefined())
    vi.useRealTimers()
  })

  it('calls onChange with name and muscle group on selection', async () => {
    const onChange = vi.fn()
    vi.useFakeTimers()
    render(<ExerciseCombobox value="" onChange={onChange} />, { wrapper })
    fireEvent.change(screen.getByPlaceholderText('e.g. Bench Press'), { target: { value: 'bench' } })
    vi.advanceTimersByTime(250)
    await waitFor(() => screen.getByText('Bench Press'))
    fireEvent.click(screen.getByText('Bench Press'))
    expect(onChange).toHaveBeenCalledWith('Bench Press', 'Chest')
    vi.useRealTimers()
  })

  it('closes dropdown on Escape', async () => {
    vi.useFakeTimers()
    render(<ExerciseCombobox value="" onChange={vi.fn()} />, { wrapper })
    const input = screen.getByPlaceholderText('e.g. Bench Press')
    fireEvent.change(input, { target: { value: 'bench' } })
    vi.advanceTimersByTime(250)
    await waitFor(() => screen.getByText('Bench Press'))
    fireEvent.keyDown(input, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByText('Bench Press')).toBeNull())
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/juraj/StudioProjects/coach-foska/admin && npx vitest run src/components/ExerciseCombobox.test.tsx
```

Expected: FAIL — `Cannot find module './ExerciseCombobox'`

- [ ] **Step 3: Implement ExerciseCombobox**

Create `admin/src/components/ExerciseCombobox.tsx`:

```tsx
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Exercise } from '../types/database'

type ExerciseResult = Pick<Exercise, 'id' | 'name_en' | 'primary_muscles' | 'image_url'>

function useExerciseSearch(term: string) {
  return useQuery<ExerciseResult[]>({
    queryKey: ['exercise-combobox', term],
    queryFn: async () => {
      const { data } = await supabase
        .from('exercises')
        .select('id, name_en, primary_muscles, image_url')
        .ilike('name_en', `%${term}%`)
        .eq('is_active', true)
        .order('name_en')
        .limit(6)
      return data ?? []
    },
    enabled: term.length >= 2,
    staleTime: 30_000,
  })
}

interface ExerciseComboboxProps {
  value: string
  onChange: (name: string, muscleGroup: string) => void
}

export function ExerciseCombobox({ value, onChange }: ExerciseComboboxProps) {
  const [inputValue, setInputValue] = useState(value)
  const [open, setOpen] = useState(false)
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setInputValue(value) }, [value])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(inputValue), 200)
    return () => clearTimeout(t)
  }, [inputValue])

  const { data: results = [] } = useExerciseSearch(debouncedTerm)

  useEffect(() => {
    if (!open || !inputRef.current) return
    const r = inputRef.current.getBoundingClientRect()
    setDropdownStyle({ position: 'fixed', top: r.bottom + 4, left: r.left, width: r.width, zIndex: 200 })
  }, [open, results])

  function handleSelect(ex: ExerciseResult) {
    onChange(ex.name_en, ex.primary_muscles?.[0] ?? '')
    setInputValue(ex.name_en)
    setOpen(false)
  }

  const showDropdown = open && results.length > 0

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        className="w-full bg-[var(--input-bg)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-disabled)] outline-none focus:border-[var(--text-muted)] transition-colors"
        value={inputValue}
        placeholder="e.g. Bench Press"
        onChange={e => {
          setInputValue(e.target.value)
          onChange(e.target.value, '')
          setOpen(true)
        }}
        onFocus={() => { if (inputValue.length >= 2) setOpen(true) }}
        onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {showDropdown && createPortal(
        <div
          style={dropdownStyle}
          className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden"
          onMouseDown={e => e.preventDefault()}
        >
          {results.map(ex => (
            <button
              key={ex.id}
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--bg-card-hover)] border-b border-[var(--border)] last:border-0 cursor-pointer bg-transparent"
              onClick={() => handleSelect(ex)}
            >
              {ex.image_url ? (
                <img src={ex.image_url} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
              ) : (
                <div className="w-6 h-6 rounded bg-[var(--bg)] flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[var(--text)] font-medium truncate">{ex.name_en}</div>
                {ex.primary_muscles?.[0] && (
                  <div className="text-xs text-[var(--text-muted)] truncate">{ex.primary_muscles[0]}</div>
                )}
              </div>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/juraj/StudioProjects/coach-foska/admin && npx vitest run src/components/ExerciseCombobox.test.tsx
```

Expected: all 5 tests pass

- [ ] **Step 5: Commit**

```bash
cd /Users/juraj/StudioProjects/coach-foska/admin && git add src/components/ExerciseCombobox.tsx src/components/ExerciseCombobox.test.tsx && git commit -m "feat(admin): ExerciseCombobox with portal dropdown and debounced search"
```

---

### Task 2: ExerciseBrowserSlideOver component

**Files:**
- Create: `admin/src/components/ExerciseBrowserSlideOver.tsx`
- Create: `admin/src/components/ExerciseBrowserSlideOver.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `admin/src/components/ExerciseBrowserSlideOver.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ExerciseBrowserSlideOver } from './ExerciseBrowserSlideOver'

const mockCategories = [
  { id: 1, name: 'Chest' },
  { id: 2, name: 'Back' },
]

const mockExercises = [
  { id: '1', name_en: 'Bench Press', primary_muscles: ['Chest'], image_url: null, category_id: 1 },
  { id: '2', name_en: 'Pull-Up', primary_muscles: ['Back'], image_url: null, category_id: 2 },
]

// Build a thenable chain so all chain termination points work
function makeExerciseChain() {
  const chain: Record<string, unknown> = {}
  const thenable = {
    then: (resolve: (v: unknown) => void) =>
      Promise.resolve({ data: mockExercises, count: mockExercises.length }).then(resolve),
  }
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['eq'] = vi.fn().mockReturnValue(chain)
  chain['order'] = vi.fn().mockReturnValue(chain)
  chain['range'] = vi.fn().mockReturnValue({ ...chain, ...thenable })
  chain['ilike'] = vi.fn().mockReturnValue({ ...chain, ...thenable })
  return chain
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'exercise_categories') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockCategories }),
          }),
        }
      }
      return makeExerciseChain()
    }),
  },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('ExerciseBrowserSlideOver', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders search input and exercise list when open', async () => {
    render(
      <ExerciseBrowserSlideOver open={true} onClose={vi.fn()} addedNames={[]} onAdd={vi.fn()} />,
      { wrapper },
    )
    expect(screen.getByPlaceholderText('Search exercises…')).toBeDefined()
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeDefined())
  })

  it('calls onAdd with name and muscle group when + is clicked', async () => {
    const onAdd = vi.fn()
    render(
      <ExerciseBrowserSlideOver open={true} onClose={vi.fn()} addedNames={[]} onAdd={onAdd} />,
      { wrapper },
    )
    await waitFor(() => screen.getByText('Bench Press'))
    fireEvent.click(screen.getByLabelText('Add Bench Press'))
    expect(onAdd).toHaveBeenCalledWith('Bench Press', 'Chest')
  })

  it('shows ✓ added badge for exercises already in addedNames', async () => {
    render(
      <ExerciseBrowserSlideOver open={true} onClose={vi.fn()} addedNames={['Bench Press']} onAdd={vi.fn()} />,
      { wrapper },
    )
    await waitFor(() => screen.getByText('Bench Press'))
    expect(screen.getByText('✓ added')).toBeDefined()
    expect(screen.queryByLabelText('Add Bench Press')).toBeNull()
  })

  it('calls onClose when Done is clicked', async () => {
    const onClose = vi.fn()
    render(
      <ExerciseBrowserSlideOver open={true} onClose={onClose} addedNames={[]} onAdd={vi.fn()} />,
      { wrapper },
    )
    await waitFor(() => screen.getByText('Bench Press'))
    fireEvent.click(screen.getByText('Done'))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders category chips from exercise_categories', async () => {
    render(
      <ExerciseBrowserSlideOver open={true} onClose={vi.fn()} addedNames={[]} onAdd={vi.fn()} />,
      { wrapper },
    )
    await waitFor(() => expect(screen.getByText('Chest')).toBeDefined())
    expect(screen.getByText('Back')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/juraj/StudioProjects/coach-foska/admin && npx vitest run src/components/ExerciseBrowserSlideOver.test.tsx
```

Expected: FAIL — `Cannot find module './ExerciseBrowserSlideOver'`

- [ ] **Step 3: Implement ExerciseBrowserSlideOver**

Create `admin/src/components/ExerciseBrowserSlideOver.tsx`:

```tsx
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/juraj/StudioProjects/coach-foska/admin && npx vitest run src/components/ExerciseBrowserSlideOver.test.tsx
```

Expected: all 5 tests pass

- [ ] **Step 5: Commit**

```bash
cd /Users/juraj/StudioProjects/coach-foska/admin && git add src/components/ExerciseBrowserSlideOver.tsx src/components/ExerciseBrowserSlideOver.test.tsx && git commit -m "feat(admin): ExerciseBrowserSlideOver with search, category chips, and pagination"
```

---

### Task 3: Wire both components into Workouts.tsx

**Files:**
- Modify: `admin/src/pages/admin/Workouts.tsx`

- [ ] **Step 1: Add slideOverOpen state and updateExerciseName helper**

In `admin/src/pages/admin/Workouts.tsx`, add the following after the existing `const [exercises, ...]` line:

```tsx
const [slideOverOpen, setSlideOverOpen] = useState(false)
```

Add `updateExerciseName` after the existing `updateExercise` function:

```tsx
function updateExerciseName(i: number, name: string, muscleGroup: string) {
  setExercises(ex => ex.map((e, idx) =>
    idx === i ? { ...e, name, ...(muscleGroup ? { muscle_group: muscleGroup } : {}) } : e
  ))
}
```

- [ ] **Step 2: Close SlideOver when the workout modal closes or saves**

In the `onClose` prop of `<Modal>`, change:
```tsx
onClose={() => setEditorOpen(false)}
```
to:
```tsx
onClose={() => { setEditorOpen(false); setSlideOverOpen(false) }}
```

In `saveWorkout.onSuccess`:
```tsx
onSuccess: () => {
  qc.invalidateQueries({ queryKey: ['workouts-admin'] })
  setEditorOpen(false)
  setSlideOverOpen(false)
},
```

- [ ] **Step 3: Replace the exercise name Input with ExerciseCombobox + Browse button**

Find this block inside the exercise card map (around line 199 in the current file):

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
  <Input label="Exercise name" value={ex.name} onChange={e => updateExercise(i, 'name', e.target.value)} placeholder="e.g. Bench Press" />
  <Input label="Muscle group" value={ex.muscle_group ?? ''} onChange={e => updateExercise(i, 'muscle_group', e.target.value)} placeholder="e.g. Chest" />
</div>
```

Replace it with:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
  <div>
    <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Exercise name</label>
    <div className="flex gap-2 items-center">
      <div className="flex-1">
        <ExerciseCombobox
          value={ex.name}
          onChange={(name, muscleGroup) => updateExerciseName(i, name, muscleGroup)}
        />
      </div>
      <button
        type="button"
        onClick={() => setSlideOverOpen(true)}
        className="flex-shrink-0 text-xs text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border border-[var(--border)] rounded-md px-2 py-2 whitespace-nowrap cursor-pointer"
        title="Browse exercise database"
      >
        ⊞ Browse
      </button>
    </div>
  </div>
  <Input label="Muscle group" value={ex.muscle_group ?? ''} onChange={e => updateExercise(i, 'muscle_group', e.target.value)} placeholder="e.g. Chest" />
</div>
```

- [ ] **Step 4: Add ExerciseBrowserSlideOver to the JSX**

After the closing `</Modal>` tag and before the final closing `</div>` of the component return, add:

```tsx
<ExerciseBrowserSlideOver
  open={slideOverOpen}
  onClose={() => setSlideOverOpen(false)}
  addedNames={exercises.map(e => e.name)}
  onAdd={(name, muscleGroup) =>
    setExercises(ex => [...ex, { ...blankExercise(), name, muscle_group: muscleGroup, sort_order: ex.length }])
  }
/>
```

- [ ] **Step 5: Add imports**

At the top of `admin/src/pages/admin/Workouts.tsx`, add:

```tsx
import { ExerciseCombobox } from '../../components/ExerciseCombobox'
import { ExerciseBrowserSlideOver } from '../../components/ExerciseBrowserSlideOver'
```

- [ ] **Step 6: Run the full test suite**

```bash
cd /Users/juraj/StudioProjects/coach-foska/admin && npx vitest run
```

Expected: all existing tests pass plus the two new test files (10 new tests total)

- [ ] **Step 7: Commit**

```bash
cd /Users/juraj/StudioProjects/coach-foska/admin && git add src/pages/admin/Workouts.tsx && git commit -m "feat(admin): wire ExerciseCombobox and ExerciseBrowserSlideOver into workout plan editor"
```
