import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Button, Input, Modal, Table, Th, Td } from '../../components/ui'
import { useAdminLayoutActions } from '../../components/AdminLayout'
import ImportExercisesModal from './ImportExercisesModal'
import type { Exercise, ExerciseCategory, Difficulty } from '../../types/database'

const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced']
const PAGE_SIZE_OPTIONS = [25, 50, 100]

function useExercises(search: string, categoryId: number | null, page: number, pageSize: number) {
  return useQuery<{ data: Exercise[]; count: number }>({
    queryKey: ['exercises-admin', search, categoryId, page, pageSize],
    queryFn: async () => {
      let q = supabase
        .from('exercises')
        .select('*', { count: 'exact' })
        .order('name_en')
        .range(page * pageSize, page * pageSize + pageSize - 1)
      if (search) q = q.ilike('name_en', `%${search}%`)
      if (categoryId !== null) q = q.eq('category_id', categoryId)
      const { data, count } = await q
      return { data: data ?? [], count: count ?? 0 }
    },
  })
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


interface ExerciseFormState {
  name_en: string
  description_en: string
  name_cs: string
  description_cs: string
  category_id: string
  image_url: string
  video_url: string
  difficulty: string
  force: string
  mechanic: string
  primary_muscles: string
  secondary_muscles: string
  equipment_names: string
  is_active: boolean
}

const blankForm = (): ExerciseFormState => ({
  name_en: '', description_en: '', name_cs: '', description_cs: '',
  category_id: '', image_url: '', video_url: '', difficulty: '',
  force: '', mechanic: '', primary_muscles: '', secondary_muscles: '',
  equipment_names: '', is_active: true,
})

export default function Exercises() {
  const qc = useQueryClient()
  const { setActions } = useAdminLayoutActions()
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [form, setForm] = useState<ExerciseFormState>(blankForm())
  const [importModalOpen, setImportModalOpen] = useState(false)

  const { data: { data: exercises = [], count: totalCount = 0 } = {}, isLoading } = useExercises(search, filterCategory, page, pageSize)
  const totalPages = Math.ceil(totalCount / pageSize)
  const { data: categories = [] } = useCategories()

  function handleSearch(value: string) { setSearch(value); setPage(0) }
  function handleCategory(value: number | null) { setFilterCategory(value); setPage(0) }
  function handlePageSize(value: number) { setPageSize(value); setPage(0) }

  function openCreate() {
    setEditing(null)
    setForm(blankForm())
    setEditorOpen(true)
  }

  function openEdit(ex: Exercise) {
    setEditing(ex)
    setForm({
      name_en: ex.name_en,
      description_en: ex.description_en,
      name_cs: ex.name_cs ?? '',
      description_cs: ex.description_cs ?? '',
      category_id: ex.category_id?.toString() ?? '',
      image_url: ex.image_url ?? '',
      video_url: ex.video_url ?? '',
      difficulty: ex.difficulty ?? '',
      force: ex.force ?? '',
      mechanic: ex.mechanic ?? '',
      primary_muscles: (ex.primary_muscles ?? []).join(', '),
      secondary_muscles: (ex.secondary_muscles ?? []).join(', '),
      equipment_names: (ex.equipment_names ?? []).join(', '),
      is_active: ex.is_active,
    })
    setEditorOpen(true)
  }

  const saveExercise = useMutation({
    mutationFn: async () => {
      const toArray = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean)
      const payload = {
        name_en: form.name_en,
        description_en: form.description_en,
        name_cs: form.name_cs || null,
        description_cs: form.description_cs || null,
        category_id: form.category_id ? parseInt(form.category_id) : null,
        image_url: form.image_url || null,
        video_url: form.video_url || null,
        difficulty: (form.difficulty as Difficulty) || null,
        force: form.force || null,
        mechanic: form.mechanic || null,
        primary_muscles: toArray(form.primary_muscles),
        secondary_muscles: toArray(form.secondary_muscles),
        equipment_names: toArray(form.equipment_names),
        is_active: form.is_active,
      }

      if (editing) {
        const { error } = await supabase.from('exercises').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('exercises').insert(payload).select('id').single()
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exercises-admin'] })
      setEditorOpen(false)
    },
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from('exercises').update({ is_active: isActive }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises-admin'] }),
  })

  useEffect(() => {
    setActions(
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => setImportModalOpen(true)}>Sync Exercises</Button>
        <Button variant="primary" onClick={openCreate}>+ Add Exercise</Button>
      </div>
    )
    return () => setActions(null)
  }, [])

  return (
    <div className="p-4 sm:p-6 max-w-6xl">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder="Search by name…"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          className="w-full sm:w-64"
        />
        <select
          className="text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-md px-3 text-[var(--text)] w-full sm:w-auto"
          value={filterCategory ?? ''}
          onChange={e => handleCategory(e.target.value ? parseInt(e.target.value) : null)}
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-sm text-[var(--text-disabled)]">Loading…</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name (EN)</Th>
              <Th>Category</Th>
              <Th>Difficulty</Th>
              <Th>Active</Th>
              <Th>{''}</Th>
            </tr>
          </thead>
          <tbody>
            {exercises.map(ex => (
              <tr key={ex.id}>
                <Td>
                  <div className="flex items-center gap-2">
                    {ex.image_url && (
                      <img src={ex.image_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                    )}
                    <span className="font-medium text-[var(--text)]">{ex.name_en}</span>
                  </div>
                </Td>
                <Td>{categories.find(c => c.id === ex.category_id)?.name ?? '—'}</Td>
                <Td>{ex.difficulty ?? '—'}</Td>
                <Td>
                  <button
                    onClick={() => toggleActive.mutate({ id: ex.id, isActive: !ex.is_active })}
                    className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer ${
                      ex.is_active
                        ? 'text-green-400 border-green-400/40 bg-green-400/10'
                        : 'text-[var(--text-disabled)] border-[var(--border)]'
                    }`}
                  >
                    {ex.is_active ? 'Active' : 'Hidden'}
                  </button>
                </Td>
                <Td>
                  <Button variant="ghost" onClick={() => openEdit(ex)}>Edit</Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {/* Pagination */}
      {!isLoading && totalCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <span>Rows per page:</span>
            <select
              className="text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
              value={pageSize}
              onChange={e => handlePageSize(parseInt(e.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
            <span>
              {page * pageSize + 1}–{Math.min(page * pageSize + pageSize, totalCount)} of {totalCount}
            </span>
            <div className="flex gap-1">
              <Button variant="ghost" onClick={() => setPage(p => p - 1)} disabled={page === 0}>←</Button>
              <Button variant="ghost" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>→</Button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editing ? 'Edit Exercise' : 'Add Exercise'}>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest">Name (EN) *</label>
              <Input value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest">Name (CS)</label>
              <Input value={form.name_cs} onChange={e => setForm(f => ({ ...f, name_cs: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest">Description (EN)</label>
              <textarea
                className="w-full text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-md px-3 py-2 text-[var(--text)] h-24 resize-none"
                value={form.description_en}
                onChange={e => setForm(f => ({ ...f, description_en: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest">Description (CS)</label>
              <textarea
                className="w-full text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-md px-3 py-2 text-[var(--text)] h-24 resize-none"
                value={form.description_cs}
                onChange={e => setForm(f => ({ ...f, description_cs: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest">Category</label>
              <select
                className="w-full text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-md px-3 py-2 text-[var(--text)]"
                value={form.category_id}
                onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
              >
                <option value="">None</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest">Difficulty</label>
              <select
                className="w-full text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-md px-3 py-2 text-[var(--text)]"
                value={form.difficulty}
                onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}
              >
                <option value="">None</option>
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex items-center sm:items-end sm:pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                <span className="text-sm text-[var(--text-muted)]">Active</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest">Image URL</label>
              <Input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://…" />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest">Video URL</label>
              <Input value={form.video_url} onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))} placeholder="https://…" />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest block mb-1">Primary Muscles <span className="normal-case">(comma-separated)</span></label>
            <Input value={form.primary_muscles} onChange={e => setForm(f => ({ ...f, primary_muscles: e.target.value }))} placeholder="e.g. chest, triceps" />
          </div>

          <div>
            <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest block mb-1">Secondary Muscles <span className="normal-case">(comma-separated)</span></label>
            <Input value={form.secondary_muscles} onChange={e => setForm(f => ({ ...f, secondary_muscles: e.target.value }))} placeholder="e.g. shoulders" />
          </div>

          <div>
            <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest block mb-1">Equipment <span className="normal-case">(comma-separated)</span></label>
            <Input value={form.equipment_names} onChange={e => setForm(f => ({ ...f, equipment_names: e.target.value }))} placeholder="e.g. barbell, bench" />
          </div>

          {saveExercise.error && (
            <p className="text-xs text-red-400">{String(saveExercise.error)}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => saveExercise.mutate()}
              disabled={!form.name_en || saveExercise.isPending}
            >
              {saveExercise.isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create Exercise'}
            </Button>
          </div>
        </div>
      </Modal>

      <ImportExercisesModal open={importModalOpen} onClose={() => setImportModalOpen(false)} />
    </div>
  )
}
