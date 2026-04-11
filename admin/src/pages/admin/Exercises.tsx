import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Button, Input, Modal, Table, Th, Td } from '../../components/ui'
import { useAdminLayoutActions } from '../../components/AdminLayout'
import type { Exercise, ExerciseCategory, Muscle, Equipment, Difficulty } from '../../types/database'

const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced']

function useExercises(search: string, categoryId: number | null) {
  return useQuery<Exercise[]>({
    queryKey: ['exercises-admin', search, categoryId],
    queryFn: async () => {
      let q = supabase.from('exercises').select('*').order('name_en')
      if (search) q = q.ilike('name_en', `%${search}%`)
      if (categoryId !== null) q = q.eq('category_id', categoryId)
      const { data } = await q
      return data ?? []
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

function useMuscles() {
  return useQuery<Muscle[]>({
    queryKey: ['muscles'],
    queryFn: async () => {
      const { data } = await supabase.from('muscles').select('*').order('name')
      return data ?? []
    },
  })
}

function useEquipment() {
  return useQuery<Equipment[]>({
    queryKey: ['equipment'],
    queryFn: async () => {
      const { data } = await supabase.from('equipment').select('*').order('name')
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
  is_active: boolean
}

const blankForm = (): ExerciseFormState => ({
  name_en: '', description_en: '', name_cs: '', description_cs: '',
  category_id: '', image_url: '', video_url: '', difficulty: '', is_active: true,
})

export default function Exercises() {
  const qc = useQueryClient()
  const { setActions } = useAdminLayoutActions()
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<number | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [form, setForm] = useState<ExerciseFormState>(blankForm())
  const [primaryMuscles, setPrimaryMuscles] = useState<number[]>([])
  const [secondaryMuscles, setSecondaryMuscles] = useState<number[]>([])
  const [selectedEquipment, setSelectedEquipment] = useState<number[]>([])

  const { data: exercises = [], isLoading } = useExercises(search, filterCategory)
  const { data: categories = [] } = useCategories()
  const { data: muscles = [] } = useMuscles()
  const { data: equipment = [] } = useEquipment()

  function openCreate() {
    setEditing(null)
    setForm(blankForm())
    setPrimaryMuscles([])
    setSecondaryMuscles([])
    setSelectedEquipment([])
    setEditorOpen(true)
  }

  async function openEdit(ex: Exercise) {
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
      is_active: ex.is_active,
    })
    const [musclesRes, equipmentRes] = await Promise.all([
      supabase.from('exercise_muscles').select('*').eq('exercise_id', ex.id),
      supabase.from('exercise_equipment').select('*').eq('exercise_id', ex.id),
    ])
    setPrimaryMuscles((musclesRes.data ?? []).filter(m => m.is_primary).map(m => m.muscle_id))
    setSecondaryMuscles((musclesRes.data ?? []).filter(m => !m.is_primary).map(m => m.muscle_id))
    setSelectedEquipment((equipmentRes.data ?? []).map(e => e.equipment_id))
    setEditorOpen(true)
  }

  const saveExercise = useMutation({
    mutationFn: async () => {
      const payload = {
        name_en: form.name_en,
        description_en: form.description_en,
        name_cs: form.name_cs || null,
        description_cs: form.description_cs || null,
        category_id: form.category_id ? parseInt(form.category_id) : null,
        image_url: form.image_url || null,
        video_url: form.video_url || null,
        difficulty: (form.difficulty as Difficulty) || null,
        is_active: form.is_active,
      }

      let exerciseId: string
      if (editing) {
        const { error } = await supabase.from('exercises').update(payload).eq('id', editing.id)
        if (error) throw error
        exerciseId = editing.id
      } else {
        const { data, error } = await supabase.from('exercises').insert(payload).select('id').single()
        if (error) throw error
        exerciseId = data.id
      }

      // Replace muscles
      const { error: delMusclesErr } = await supabase.from('exercise_muscles').delete().eq('exercise_id', exerciseId)
      if (delMusclesErr) throw delMusclesErr
      const muscleRows = [
        ...primaryMuscles.map(id => ({ exercise_id: exerciseId, muscle_id: id, is_primary: true })),
        ...secondaryMuscles.map(id => ({ exercise_id: exerciseId, muscle_id: id, is_primary: false })),
      ]
      if (muscleRows.length > 0) {
        const { error } = await supabase.from('exercise_muscles').insert(muscleRows)
        if (error) throw error
      }

      // Replace equipment
      const { error: delEquipmentErr } = await supabase.from('exercise_equipment').delete().eq('exercise_id', exerciseId)
      if (delEquipmentErr) throw delEquipmentErr
      const equipmentRows = selectedEquipment.map(id => ({ exercise_id: exerciseId, equipment_id: id }))
      if (equipmentRows.length > 0) {
        const { error } = await supabase.from('exercise_equipment').insert(equipmentRows)
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
      <Button variant="primary" onClick={openCreate}>+ Add Exercise</Button>
    )
    return () => setActions(null)
  }, [])

  function toggleMuscle(id: number, list: number[], setList: (v: number[]) => void) {
    setList(list.includes(id) ? list.filter(m => m !== id) : [...list, id])
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder="Search by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full sm:w-64"
        />
        <select
          className="text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-md px-3 text-[var(--text)] w-full sm:w-auto"
          value={filterCategory ?? ''}
          onChange={e => setFilterCategory(e.target.value ? parseInt(e.target.value) : null)}
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

          {/* Muscles */}
          <div>
            <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest block mb-1">Primary Muscles</label>
            <div className="flex flex-wrap gap-1">
              {muscles.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMuscle(m.id, primaryMuscles, setPrimaryMuscles)}
                  className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${
                    primaryMuscles.includes(m.id)
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                      : 'text-[var(--text-muted)] border-[var(--border)]'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest block mb-1">Secondary Muscles</label>
            <div className="flex flex-wrap gap-1">
              {muscles.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMuscle(m.id, secondaryMuscles, setSecondaryMuscles)}
                  className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${
                    secondaryMuscles.includes(m.id)
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'text-[var(--text-muted)] border-[var(--border)]'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest block mb-1">Equipment</label>
            <div className="flex flex-wrap gap-1">
              {equipment.map(eq => (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => toggleMuscle(eq.id, selectedEquipment, setSelectedEquipment)}
                  className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${
                    selectedEquipment.includes(eq.id)
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'text-[var(--text-muted)] border-[var(--border)]'
                  }`}
                >
                  {eq.name}
                </button>
              ))}
            </div>
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
    </div>
  )
}
