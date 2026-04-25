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
  const skipDebounce = useRef(false)

  useEffect(() => { setInputValue(value) }, [value])

  useEffect(() => {
    if (skipDebounce.current) { skipDebounce.current = false; return }
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
    skipDebounce.current = true
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
