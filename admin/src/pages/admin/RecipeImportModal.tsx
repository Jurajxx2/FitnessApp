// admin/src/pages/admin/RecipeImportModal.tsx
import { useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { parseRecipeImport, validateRecipeImport, type RecipeImportRow, type ImportError } from '../../lib/importers'
import { Button, Modal, Table, Th, Td } from '../../components/ui'

interface Props {
  open: boolean
  onClose: () => void
}

type ParseState =
  | { status: 'idle' }
  | { status: 'errors'; errors: ImportError[] }
  | { status: 'ready'; rows: RecipeImportRow[] }

const EXAMPLE_JSON = JSON.stringify(
  [
    {
      external_id: 'overnight-oats',
      name: 'Overnight Oats',
      description: 'Quick and easy breakfast',
      prep_time_min: 5,
      servings: 1,
      photo_file_name: 'overnight-oats.jpg',
      ingredients: [
        { name: 'Oats', quantity: 80, unit: 'g', calories: 300, protein_g: 10, carbs_g: 55, fat_g: 6 },
        { name: 'Milk', quantity: 200, unit: 'ml', calories: 86, protein_g: 6, carbs_g: 10, fat_g: 3 },
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
  a.download = 'recipes-import-example.json'
  a.click()
  URL.revokeObjectURL(url)
}

function calcMacros(ingredients: RecipeImportRow['ingredients']) {
  return ingredients.reduce(
    (acc, ing) => ({
      calories: acc.calories + ing.calories,
      protein_g: acc.protein_g + ing.protein_g,
      carbs_g: acc.carbs_g + ing.carbs_g,
      fat_g: acc.fat_g + ing.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  )
}

export default function RecipeImportModal({ open, onClose }: Props) {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [parseState, setParseState] = useState<ParseState>({ status: 'idle' })
  const [insertResult, setInsertResult] = useState<{ inserted: number; failed: number } | null>(null)

  const { data: existingExternalIds = [] } = useQuery({
    queryKey: ['recipes-external-ids'],
    queryFn: async () => {
      const { data } = await supabase.from('recipes').select('external_id').not('external_id', 'is', null)
      return (data ?? []).map(r => r.external_id as string)
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
      const parsed = parseRecipeImport(json)
      if (!parsed.ok) { setParseState({ status: 'errors', errors: parsed.errors }); return }
      const validated = validateRecipeImport(parsed.rows, existingExternalIds)
      if (!validated.ok) { setParseState({ status: 'errors', errors: validated.errors }); return }
      setParseState({ status: 'ready', rows: validated.rows })
    } catch {
      setParseState({ status: 'errors', errors: [{ row: -1, field: 'file', message: 'Invalid JSON file' }] })
    }
  }

  const insertMutation = useMutation({
    mutationFn: async (rows: RecipeImportRow[]) => {
      let inserted = 0
      let failed = 0
      for (const row of rows) {
        const macros = calcMacros(row.ingredients)
        const { data: recipe, error: recipeErr } = await supabase
          .from('recipes')
          .insert({
            external_id: row.external_id,
            name: row.name,
            description: row.description,
            prep_time_min: row.prep_time_min,
            servings: row.servings,
            photo_file_name: row.photo_file_name,
            ...macros,
          })
          .select()
          .single()

        if (recipeErr) { failed++; continue }

        if (row.ingredients.length) {
          await supabase.from('recipe_ingredients').insert(
            row.ingredients.map((ing, i) => ({ ...ing, recipe_id: recipe.id, sort_order: i })),
          )
        }
        inserted++
      }
      return { inserted, failed }
    },
    onSuccess: result => {
      qc.invalidateQueries({ queryKey: ['recipes-admin'] })
      qc.invalidateQueries({ queryKey: ['recipes-external-ids'] })
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
      title="Import Recipes"
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
            Insert {rows.length > 0 ? `${rows.length} recipe${rows.length === 1 ? '' : 's'}` : ''}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
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
            <p className="text-xs text-[var(--text-muted)] mb-2">{rows.length} recipe{rows.length === 1 ? '' : 's'} ready to import</p>
            <Table>
              <thead>
                <tr>
                  <Th>External ID</Th><Th>Name</Th><Th>Ingredients</Th><Th>Calories</Th><Th>Photo</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const macros = calcMacros(r.ingredients)
                  return (
                    <tr key={i}>
                      <Td className="font-mono text-xs">{r.external_id}</Td>
                      <Td className="font-semibold text-[var(--text)]">{r.name}</Td>
                      <Td>{r.ingredients.length}</Td>
                      <Td>{Math.round(macros.calories)} kcal</Td>
                      <Td>{r.photo_file_name ?? '—'}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </div>
        )}
      </div>
    </Modal>
  )
}
