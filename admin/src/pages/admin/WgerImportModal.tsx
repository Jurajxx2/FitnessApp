// admin/src/pages/admin/WgerImportModal.tsx
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Button, Modal } from '../../components/ui'

interface Props {
  open: boolean
  onClose: () => void
}

type ImportState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; categories: number; muscles: number; equipment: number; imported: number; skipped: number }
  | { status: 'error'; message: string }

export default function WgerImportModal({ open, onClose }: Props) {
  const qc = useQueryClient()
  const [state, setState] = useState<ImportState>({ status: 'idle' })

  async function runImport() {
    setState({ status: 'running' })
    try {
      const { data, error } = await supabase.functions.invoke('import-exercises')
      if (error) throw error
      const result = data as { categories: number; muscles: number; equipment: number; imported: number; skipped: number }
      setState({ status: 'done', ...result })
      qc.invalidateQueries({ queryKey: ['exercises-admin'] })
      qc.invalidateQueries({ queryKey: ['exercise-categories'] })
      qc.invalidateQueries({ queryKey: ['muscles'] })
      qc.invalidateQueries({ queryKey: ['equipment'] })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setState({ status: 'error', message })
    }
  }

  function handleClose() {
    if (state.status === 'running') return
    setState({ status: 'idle' })
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Import from wger.de"
      footer={
        state.status === 'idle' ? (
          <>
            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
            <Button variant="primary" onClick={runImport}>Start Import</Button>
          </>
        ) : state.status === 'running' ? (
          <Button variant="ghost" disabled>Importing…</Button>
        ) : (
          <Button variant="primary" onClick={handleClose}>Close</Button>
        )
      }
    >
      <div className="flex flex-col gap-4 text-sm text-[var(--text-muted)]">
        {state.status === 'idle' && (
          <>
            <p>This will fetch ~800 exercises from <span className="text-[var(--text)]">wger.de</span> including:</p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>Exercise categories, muscles, and equipment</li>
              <li>Exercise names + descriptions in English and Czech</li>
              <li>Exercise images (uploaded to Supabase Storage)</li>
            </ul>
            <p className="text-[var(--text-disabled)]">
              This may take 2–3 minutes. It is safe to re-run — all inserts use upsert.
            </p>
          </>
        )}

        {state.status === 'running' && (
          <div className="flex items-center gap-3 py-4">
            <span className="animate-spin text-xl">⟳</span>
            <span>Importing exercises from wger.de… this may take a few minutes.</span>
          </div>
        )}

        {state.status === 'done' && (
          <div className="rounded-lg p-4 bg-[var(--bg)] border border-[var(--border)] space-y-1">
            <p className="text-green-400 font-semibold">Import complete</p>
            <p>{state.imported} exercises imported · {state.skipped} skipped</p>
            <p className="text-[var(--text-disabled)] text-xs">
              {state.categories} categories · {state.muscles} muscles · {state.equipment} equipment types
            </p>
          </div>
        )}

        {state.status === 'error' && (
          <div className="rounded-lg p-4 bg-red-950/30 border border-red-800/40">
            <p className="text-red-400 font-semibold text-xs mb-1">Import failed</p>
            <p className="text-red-300 text-xs">{state.message}</p>
          </div>
        )}
      </div>
    </Modal>
  )
}
