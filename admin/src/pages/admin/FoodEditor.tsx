import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, EditorPage, EmptyState, FormSection, Input, Shimmer, StatRow, useNotice } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import type { Food } from '../../types/database'

interface FoodFormState {
  name: string
  calories: string
  protein_g: string
  carbs_g: string
  fat_g: string
  serving_size: string
  serving_unit: string
  brand: string
  is_verified: boolean
}

const blankForm = (): FoodFormState => ({
  name: '',
  calories: '0',
  protein_g: '0',
  carbs_g: '0',
  fat_g: '0',
  serving_size: '100',
  serving_unit: 'g',
  brand: '',
  is_verified: true,
})

function useFood(id: string | undefined) {
  return useQuery<Food>({
    queryKey: ['food-admin', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('foods').select('*').eq('id', id!).single()
      if (error) throw error
      return data
    },
  })
}

export default function FoodEditor() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify } = useNotice()
  const { data: food, isLoading, isError, error } = useFood(id)
  const [form, setForm] = useState<FoodFormState>(blankForm())

  useEffect(() => {
    if (!food) return
    setForm({
      name: food.name,
      calories: String(food.calories),
      protein_g: String(food.protein_g),
      carbs_g: String(food.carbs_g),
      fat_g: String(food.fat_g),
      serving_size: String(food.serving_size),
      serving_unit: food.serving_unit,
      brand: food.brand ?? '',
      is_verified: food.is_verified,
    })
  }, [food])

  const numericValues = [form.calories, form.protein_g, form.carbs_g, form.fat_g].map(Number)
  const hasInvalidNumbers = numericValues.some(value => !Number.isFinite(value) || value < 0)
    || !Number.isFinite(Number(form.serving_size))
    || Number(form.serving_size) <= 0

  const saveFood = useMutation({
    mutationFn: async () => {
      if (hasInvalidNumbers) throw new Error('Serving size must be greater than zero and nutrition values cannot be negative.')
      const payload = {
        name: form.name.trim(),
        calories: Number(form.calories),
        protein_g: Number(form.protein_g),
        carbs_g: Number(form.carbs_g),
        fat_g: Number(form.fat_g),
        serving_size: Number(form.serving_size),
        serving_unit: form.serving_unit.trim(),
        brand: form.brand.trim() || null,
        is_verified: form.is_verified,
      }
      if (id) {
        const { error: updateError } = await supabase.from('foods').update(payload).eq('id', id)
        if (updateError) throw updateError
        return id
      }
      const { data, error: insertError } = await supabase.from('foods').insert(payload).select('id').single()
      if (insertError) throw insertError
      return data.id
    },
    onSuccess: foodId => {
      queryClient.invalidateQueries({ queryKey: ['foods-admin'] })
      queryClient.invalidateQueries({ queryKey: ['food-admin', foodId] })
      notify(isNew ? 'Food added.' : 'Food updated.')
      if (isNew) navigate(`/admin/nutrition/foods/${foodId}`, { replace: true })
    },
    onError: mutationError => notify(`Couldn’t save food: ${mutationError.message}`, 'error'),
  })

  if (!isNew && isLoading) {
    return <EditorPage backTo="/admin/nutrition?tab=foods" backLabel="Back to foods" eyebrow="Food library" title="Loading food…"><Shimmer className="h-80 w-full" /></EditorPage>
  }

  if (!isNew && (isError || !food)) {
    return <EditorPage backTo="/admin/nutrition?tab=foods" backLabel="Back to foods" eyebrow="Food library" title="Food unavailable"><EmptyState title="This food couldn’t be loaded" description={error?.message ?? 'It may have been removed.'} /></EditorPage>
  }

  return (
    <EditorPage
      backTo="/admin/nutrition?tab=foods"
      backLabel="Back to foods"
      eyebrow="Food library"
      title={isNew ? 'Add food' : form.name || 'Edit food'}
      description="Define one normalized serving and the nutrition values athletes will see when logging meals."
      maxWidth="6xl"
      actions={
        <>
          <Button variant="ghost" onClick={() => navigate('/admin/nutrition?tab=foods')}>Cancel</Button>
          <Button onClick={() => saveFood.mutate()} loading={saveFood.isPending} disabled={!form.name.trim() || !form.serving_unit.trim() || hasInvalidNumbers}>{isNew ? 'Add food' : 'Save changes'}</Button>
        </>
      }
      aside={
        <>
          <Card>
            <p className="flex items-center gap-2 ledger-label text-text-secondary">
              <span className="h-3.5 w-[3px] shrink-0 rounded-full bg-accent-strong" aria-hidden="true" />
              Per serving
            </p>
            <p className="mt-1 text-sm text-text-secondary">{form.serving_size || '0'} {form.serving_unit || 'units'}</p>
            <div className="mt-4"><StatRow items={[
              { label: 'Kcal', value: String(Math.round(Number(form.calories) || 0)) },
              { label: 'Protein', value: `${Number(form.protein_g) || 0}g` },
              { label: 'Carbs', value: `${Number(form.carbs_g) || 0}g` },
              { label: 'Fat', value: `${Number(form.fat_g) || 0}g` },
            ]} /></div>
          </Card>
          <Card>
            <BadgeCheck size={19} className="text-accent" aria-hidden="true" />
            <label className="mt-3 flex cursor-pointer items-start gap-3">
              <input type="checkbox" className="mt-1" checked={form.is_verified} onChange={event => setForm(current => ({ ...current, is_verified: event.target.checked }))} />
              <span><span className="block text-sm font-semibold text-text-primary">Coach verified</span><span className="mt-1 block text-xs leading-5 text-text-secondary">Use this only when the serving and macros have been checked against a reliable label or database.</span></span>
            </label>
          </Card>
        </>
      }
    >
      <FormSection title="Identity" description="Use a recognizable food name and keep brand separate so search results stay readable.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Food name" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="Greek yogurt" required autoFocus={isNew} />
          <Input label="Brand / manufacturer" value={form.brand} onChange={event => setForm(current => ({ ...current, brand: event.target.value }))} placeholder="Optional" />
        </div>
      </FormSection>

      <FormSection title="Serving" description="All macro values below describe exactly this serving size.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Serving size" type="number" min="0.01" step="any" value={form.serving_size} onChange={event => setForm(current => ({ ...current, serving_size: event.target.value }))} />
          <Input label="Serving unit" value={form.serving_unit} onChange={event => setForm(current => ({ ...current, serving_unit: event.target.value }))} placeholder="g, ml, piece…" required />
        </div>
      </FormSection>

      <FormSection title="Nutrition" description="Values cannot be negative. Decimal values are supported.">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Input label="Calories" type="number" min="0" step="any" value={form.calories} onChange={event => setForm(current => ({ ...current, calories: event.target.value }))} />
          <Input label="Protein (g)" type="number" min="0" step="any" value={form.protein_g} onChange={event => setForm(current => ({ ...current, protein_g: event.target.value }))} />
          <Input label="Carbs (g)" type="number" min="0" step="any" value={form.carbs_g} onChange={event => setForm(current => ({ ...current, carbs_g: event.target.value }))} />
          <Input label="Fat (g)" type="number" min="0" step="any" value={form.fat_g} onChange={event => setForm(current => ({ ...current, fat_g: event.target.value }))} />
        </div>
        {hasInvalidNumbers && <p role="alert" className="mt-4 text-sm text-error">Serving size must be greater than zero and nutrition values cannot be negative.</p>}
      </FormSection>

      {saveFood.error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{saveFood.error.message}</p>}
    </EditorPage>
  )
}
