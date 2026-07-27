import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Image as ImageIcon } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, EditorPage, EmptyState, FormSection, Input, Shimmer, useNotice } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import type { Difficulty, Exercise, ExerciseCategory } from '../../types/database'

const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced']

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
  name_en: '',
  description_en: '',
  name_cs: '',
  description_cs: '',
  category_id: '',
  image_url: '',
  video_url: '',
  difficulty: '',
  force: '',
  mechanic: '',
  primary_muscles: '',
  secondary_muscles: '',
  equipment_names: '',
  is_active: true,
})

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

function useExercise(id: string | undefined) {
  return useQuery<Exercise>({
    queryKey: ['exercise-admin', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('exercises').select('*').eq('id', id!).single()
      if (error) throw error
      return data
    },
  })
}

export default function ExerciseEditor() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify } = useNotice()
  const { data: exercise, isLoading, isError, error } = useExercise(id)
  const { data: categories = [] } = useCategories()
  const [form, setForm] = useState<ExerciseFormState>(blankForm())

  useEffect(() => {
    if (!exercise) return
    setForm({
      name_en: exercise.name_en,
      description_en: exercise.description_en,
      name_cs: exercise.name_cs ?? '',
      description_cs: exercise.description_cs ?? '',
      category_id: exercise.category_id?.toString() ?? '',
      image_url: exercise.image_url ?? '',
      video_url: exercise.video_url ?? '',
      difficulty: exercise.difficulty ?? '',
      force: exercise.force ?? '',
      mechanic: exercise.mechanic ?? '',
      primary_muscles: (exercise.primary_muscles ?? []).join(', '),
      secondary_muscles: (exercise.secondary_muscles ?? []).join(', '),
      equipment_names: (exercise.equipment_names ?? []).join(', '),
      is_active: exercise.is_active,
    })
  }, [exercise])

  const saveExercise = useMutation({
    mutationFn: async () => {
      const toArray = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean)
      const payload = {
        name_en: form.name_en.trim(),
        description_en: form.description_en,
        name_cs: form.name_cs || null,
        description_cs: form.description_cs || null,
        category_id: form.category_id ? Number(form.category_id) : null,
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

      if (id) {
        const { error: updateError } = await supabase.from('exercises').update(payload).eq('id', id)
        if (updateError) throw updateError
        return id
      }
      const { data, error: insertError } = await supabase.from('exercises').insert(payload).select('id').single()
      if (insertError) throw insertError
      return data.id
    },
    onSuccess: exerciseId => {
      queryClient.invalidateQueries({ queryKey: ['exercises-admin'] })
      queryClient.invalidateQueries({ queryKey: ['exercise-admin', exerciseId] })
      notify(isNew ? 'Exercise added.' : 'Exercise updated.')
      if (isNew) navigate(`/admin/exercises/${exerciseId}`, { replace: true })
    },
    onError: mutationError => notify(`Couldn’t save exercise: ${mutationError.message}`, 'error'),
  })

  if (!isNew && isLoading) {
    return <EditorPage backTo="/admin/exercises" backLabel="Back to exercises" eyebrow="Exercise library" title="Loading exercise…"><Shimmer className="h-96 w-full" /></EditorPage>
  }

  if (!isNew && (isError || !exercise)) {
    return <EditorPage backTo="/admin/exercises" backLabel="Back to exercises" eyebrow="Exercise library" title="Exercise unavailable"><EmptyState title="This exercise couldn’t be loaded" description={error?.message ?? 'It may have been removed.'} /></EditorPage>
  }

  return (
    <EditorPage
      backTo="/admin/exercises"
      backLabel="Back to exercises"
      eyebrow="Exercise library"
      title={isNew ? 'Add exercise' : form.name_en || 'Edit exercise'}
      description="Keep athlete-facing copy, classification, media, and coaching metadata together."
      actions={
        <>
          <Button variant="ghost" onClick={() => navigate('/admin/exercises')}>Cancel</Button>
          <Button onClick={() => saveExercise.mutate()} loading={saveExercise.isPending} disabled={!form.name_en.trim()}>{isNew ? 'Create exercise' : 'Save changes'}</Button>
        </>
      }
      aside={
        <>
          <Card className="overflow-hidden p-0">
            {form.image_url ? (
              <img src={form.image_url} alt="Exercise preview" className="aspect-[4/3] w-full object-cover" />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center bg-surface">
                <ImageIcon size={30} className="text-text-secondary" aria-hidden="true" />
              </div>
            )}
            <div className="p-5">
              <p className="flex items-center gap-2 ledger-label text-text-secondary">
                <span className="h-3.5 w-[3px] shrink-0 rounded-full bg-accent-strong" aria-hidden="true" />
                Preview
              </p>
              <h2 className="mt-1.5 font-display font-bold tracking-tight text-text-primary">{form.name_en || 'Untitled exercise'}</h2>
              <p className="mt-2 text-xs leading-5 text-text-secondary">{form.description_en || 'Add a concise description so athletes know what this movement is for.'}</p>
            </div>
          </Card>
          <Card>
            <Eye size={19} className="text-accent" aria-hidden="true" />
            <label className="mt-3 flex cursor-pointer items-start gap-3">
              <input type="checkbox" className="mt-1" checked={form.is_active} onChange={event => setForm(current => ({ ...current, is_active: event.target.checked }))} />
              <span>
                <span className="block text-sm font-semibold text-text-primary">Visible to athletes</span>
                <span className="mt-1 block text-xs leading-5 text-text-secondary">Hidden exercises remain in existing logs but cannot be newly selected.</span>
              </span>
            </label>
          </Card>
        </>
      }
    >
      <FormSection title="Names and descriptions" description="English is required. Czech copy is optional and can be completed later.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Name (EN)" value={form.name_en} onChange={event => setForm(current => ({ ...current, name_en: event.target.value }))} required autoFocus={isNew} />
          <Input label="Name (CS)" value={form.name_cs} onChange={event => setForm(current => ({ ...current, name_cs: event.target.value }))} />
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Description (EN)</label>
            <textarea className="min-h-32 w-full resize-y rounded-xl border border-outline bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" value={form.description_en} onChange={event => setForm(current => ({ ...current, description_en: event.target.value }))} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Description (CS)</label>
            <textarea className="min-h-32 w-full resize-y rounded-xl border border-outline bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" value={form.description_cs} onChange={event => setForm(current => ({ ...current, description_cs: event.target.value }))} />
          </div>
        </div>
      </FormSection>

      <FormSection title="Classification" description="These fields power library filters and help coaches choose suitable movements.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Category</label>
            <select className="h-10 w-full rounded-xl border border-outline bg-surface px-3 text-sm text-text-primary outline-none focus:border-accent" value={form.category_id} onChange={event => setForm(current => ({ ...current, category_id: event.target.value }))}>
              <option value="">None</option>
              {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Difficulty</label>
            <select className="h-10 w-full rounded-xl border border-outline bg-surface px-3 text-sm capitalize text-text-primary outline-none focus:border-accent" value={form.difficulty} onChange={event => setForm(current => ({ ...current, difficulty: event.target.value }))}>
              <option value="">None</option>
              {DIFFICULTIES.map(difficulty => <option key={difficulty} value={difficulty}>{difficulty}</option>)}
            </select>
          </div>
          <Input label="Force" value={form.force} onChange={event => setForm(current => ({ ...current, force: event.target.value }))} placeholder="push / pull / static" />
          <Input label="Mechanic" value={form.mechanic} onChange={event => setForm(current => ({ ...current, mechanic: event.target.value }))} placeholder="compound / isolation" />
        </div>
      </FormSection>

      <FormSection title="Muscles and equipment" description="Enter comma-separated values. They are normalized when the exercise is saved.">
        <div className="grid gap-4">
          <Input label="Primary muscles" value={form.primary_muscles} onChange={event => setForm(current => ({ ...current, primary_muscles: event.target.value }))} placeholder="chest, triceps" />
          <Input label="Secondary muscles" value={form.secondary_muscles} onChange={event => setForm(current => ({ ...current, secondary_muscles: event.target.value }))} placeholder="shoulders" />
          <Input label="Equipment" value={form.equipment_names} onChange={event => setForm(current => ({ ...current, equipment_names: event.target.value }))} placeholder="barbell, bench" />
        </div>
      </FormSection>

      <FormSection title="Media" description="Use stable, HTTPS-hosted assets that can be loaded by both web and mobile apps.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Image URL" type="url" value={form.image_url} onChange={event => setForm(current => ({ ...current, image_url: event.target.value }))} placeholder="https://…" />
          <Input label="Video URL" type="url" value={form.video_url} onChange={event => setForm(current => ({ ...current, video_url: event.target.value }))} placeholder="https://…" />
        </div>
      </FormSection>

      {saveExercise.error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{saveExercise.error.message}</p>}
    </EditorPage>
  )
}
