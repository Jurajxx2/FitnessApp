// admin/src/pages/admin/MealPlanImportModal.tsx
import { useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { parseMealPlanImport, validateMealPlanImport, type MealPlanImportRow, type ImportError } from '../../lib/importers'
import { Button, Modal, Table, Th, Td } from '../../components/ui'

interface Props {
  open: boolean
  onClose: () => void
}

type ParseState =
  | { status: 'idle' }
  | { status: 'errors'; errors: ImportError[] }
  | { status: 'ready'; rows: MealPlanImportRow[] }

const EXAMPLE_JSON = JSON.stringify(
  [
    {
      name: 'Week 1 Bulking',
      description: 'High protein week',
      valid_from: '2026-04-07',
      valid_to: '2026-04-13',
      is_active: false,
      meals: [
        {
          name: 'Breakfast',
          time_of_day: '08:00',
          recipes: [{ external_id: 'overnight-oats', meal_type: 'breakfast' }],
        },
        {
          name: 'Lunch',
          time_of_day: '12:30',
          recipes: [{ external_id: 'chicken-rice-bowl', meal_type: 'lunch' }],
        },
      ],
    },
  ],
  null,
  2,
)

function downloadExample() {
  const blob = new Blob([EXAMPLE_JSON], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'meal-plans-import-example.json'
  a.click()
  URL.revokeObjectURL(url)
}

export default function MealPlanImportModal({ open, onClose }: Props) {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [parseState, setParseState] = useState<ParseState>({ status: 'idle' })
  const [insertResult, setInsertResult] = useState<{ inserted: number; failed: number } | null>(null)

  // Fetch all known recipe external_ids for validation
  const { data: knownExternalIds = [] } = useQuery({
    queryKey: ['recipes-external-ids-mealplan'],
    queryFn: async () => {
      const { data } = await supabase.from('recipes').select('external_id').not('external_id', 'is', null)
      return (data ?? []).map(r => r.external_id as string)
    },
    enabled: open,
  })

  // Build a map from external_id → recipe UUID for inserts
  const { data: externalIdToUuid = {} } = useQuery({
    queryKey: ['recipes-external-id-map'],
    queryFn: async () => {
      const { data } = await supabase.from('recipes').select('id, external_id').not('external_id', 'is', null)
      const map: Record<string, string> = {}
      for (const r of data ?? []) map[r.external_id as string] = r.id
      return map
    },
    enabled: open,
  })

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setInsertResult(null)

    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const parsed = parseMealPlanImport(json)
      if (!parsed.ok) { setParseState({ status: 'errors', errors: parsed.errors }); return }
      const validated = validateMealPlanImport(parsed.rows, knownExternalIds)
      if (!validated.ok) { setParseState({ status: 'errors', errors: validated.errors }); return }
      setParseState({ status: 'ready', rows: validated.rows })
    } catch {
      setParseState({ status: 'errors', errors: [{ row: -1, field: 'file', message: 'Invalid JSON file' }] })
    }
  }

  const insertMutation = useMutation({
    mutationFn: async (rows: MealPlanImportRow[]) => {
      let inserted = 0
      let failed = 0

      for (const row of rows) {
        try {
          const { data: plan, error: planErr } = await supabase
            .from('meal_plans')
            .insert({
              name: row.name,
              description: row.description,
              valid_from: row.valid_from,
              valid_to: row.valid_to,
              is_active: row.is_active,
            })
            .select()
            .single()

          if (planErr) throw planErr

          for (let i = 0; i < row.meals.length; i++) {
            const mealSlot = row.meals[i]
            const { data: meal, error: mealErr } = await supabase
              .from('meals')
              .insert({
                meal_plan_id: plan.id,
                name: mealSlot.name,
                time_of_day: mealSlot.time_of_day,
                sort_order: i,
              })
              .select()
              .single()

            if (mealErr) throw mealErr

            if (mealSlot.recipes.length) {
              await supabase.from('meal_plan_recipes').insert(
                mealSlot.recipes.map(r => ({
                  meal_plan_id: plan.id,
                  meal_id: meal.id,
                  recipe_id: externalIdToUuid[r.external_id],
                  meal_type: r.meal_type,
                })),
              )
            }
          }

          inserted++
        } catch {
          failed++
        }
      }

      return { inserted, failed }
    },
    onSuccess: result => {
      qc.invalidateQueries({ queryKey: ['meal-plans-admin'] })
      setInsertResult(result)
      setParseState({ status: 'idle' })
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
  })

  function handleClose() {
    setParseState({ status: 'idle' })
    setInsertResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose()
  }

  const rows = parseState.status === 'ready' ? parseState.rows : []

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import Meal Plans"
      footer={
        <>
          <button onClick={downloadExample} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer mr-auto">
            Download example JSON
          </button>
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={() => parseState.status === 'ready' && insertMutation.mutate(rows)}
            loading={insertMutation.isPending}
            disabled={parseState.status !== 'ready'}
          >
            Insert {rows.length > 0 ? `${rows.length} plan${rows.length === 1 ? '' : 's'}` : ''}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs text-[var(--text-muted)]">
          Recipes referenced in the file must already exist (import recipes first). References are matched by <span className="font-mono">external_id</span>.
        </p>

        <div>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={onFileSelected} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-[var(--border)] rounded-lg p-6 text-center text-sm text-[var(--text-muted)] hover:border-[var(--text-disabled)] hover:text-[var(--text)] bg-transparent cursor-pointer transition-colors"
          >
            Click to select a JSON file
          </button>
        </div>

        {insertResult && (
          <div className="rounded-lg p-3 bg-[var(--bg)] border border-[var(--border)] text-sm">
            <span className="text-green-400">{insertResult.inserted} inserted</span>
            {insertResult.failed > 0 && <span className="text-red-400 ml-3">{insertResult.failed} failed</span>}
          </div>
        )}

        {parseState.status === 'errors' && (
          <div className="rounded-lg p-3 bg-red-950/30 border border-red-800/40">
            <p className="text-xs font-semibold text-red-400 mb-2">Validation errors</p>
            {parseState.errors.map((e, i) => (
              <p key={i} className="text-xs text-red-300">
                {e.row >= 0 ? `Row ${e.row + 1} · ` : ''}{e.field}: {e.message}
              </p>
            ))}
          </div>
        )}

        {parseState.status === 'ready' && (
          <div className="overflow-x-auto">
            <p className="text-xs text-[var(--text-muted)] mb-2">{rows.length} meal plan{rows.length === 1 ? '' : 's'} ready to import</p>
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th><Th>Meals</Th><Th>Recipes</Th><Th>Valid from</Th><Th>Valid to</Th><Th>Active</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p, i) => (
                  <tr key={i}>
                    <Td className="font-semibold text-[var(--text)]">{p.name}</Td>
                    <Td>{p.meals.length}</Td>
                    <Td>{p.meals.reduce((sum, m) => sum + m.recipes.length, 0)}</Td>
                    <Td>{p.valid_from ?? '—'}</Td>
                    <Td>{p.valid_to ?? '—'}</Td>
                    <Td>{p.is_active ? <span className="text-green-400 text-xs">Yes</span> : <span className="text-[var(--text-disabled)] text-xs">No</span>}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>
    </Modal>
  )
}
