// admin/src/pages/admin/ImportExercisesModal.tsx
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Modal, Button } from '../../components/ui'
import { supabase } from '../../lib/supabase'

interface ImportExercisesModalProps {
  open: boolean
  onClose: () => void
}

const JSON_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'
const IMAGE_BASE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'

const CATEGORY_MAP: Record<string, number> = {
  strength: 10,
  stretching: 11,
  cardio: 12,
  powerlifting: 10,
  strongman: 10,
  plyometrics: 10,
  yoga: 11,
  'olympic weightlifting': 10,
}

export default function ImportExercisesModal({ open, onClose }: ImportExercisesModalProps) {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  async function startImport() {
    setLoading(true)
    setStatus('Fetching data from repository...')
    try {
      const res = await fetch(JSON_URL)
      if (!res.ok) throw new Error('Failed to fetch source data')
      const exercises: any[] = await res.json()
      setProgress({ current: 0, total: exercises.length })

      const batchSize = 10
      for (let i = 0; i < exercises.length; i += batchSize) {
        const batch = exercises.slice(i, i + batchSize)
        setStatus(`Importing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(exercises.length / batchSize)}…`)

        await Promise.all(batch.map(async (ex: any) => {
          const imagePath = ex.images?.[0] ? `${IMAGE_BASE_URL}${ex.images[0]}` : null

          await supabase.from('exercises').upsert({
            name_en: ex.name,
            description_en: Array.isArray(ex.instructions) ? ex.instructions.join('\n\n') : '',
            category_id: CATEGORY_MAP[ex.category?.toLowerCase()] ?? 10,
            image_url: imagePath,
            difficulty: ex.level ?? null,
            force: ex.force ?? null,
            mechanic: ex.mechanic ?? null,
            primary_muscles: Array.isArray(ex.primaryMuscles) ? ex.primaryMuscles : [],
            secondary_muscles: Array.isArray(ex.secondaryMuscles) ? ex.secondaryMuscles : [],
            equipment_names: ex.equipment ? [ex.equipment] : [],
            is_active: true,
          }, { onConflict: 'name_en' })
        }))

        setProgress(p => ({ ...p, current: Math.min(i + batchSize, p.total) }))
      }

      setStatus('Done! Refreshing list...')
      qc.invalidateQueries({ queryKey: ['exercises-admin'] })
      setTimeout(onClose, 1500)
    } catch (err: any) {
      setStatus(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={loading ? () => {} : onClose} title="Sync Exercises">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--text-muted)]">
          This will sync exercises from the <strong>free-exercise-db</strong> repository (~800 exercises).
          Existing exercises are updated by English name.
        </p>

        {status && (
          <div className="bg-zinc-900/50 p-3 rounded-md border border-zinc-800">
            <p className="text-xs font-mono text-zinc-400 mb-2">{status}</p>
            {progress.total > 0 && (
              <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-white h-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" onClick={startImport} loading={loading}>
            Start Sync
          </Button>
        </div>
      </div>
    </Modal>
  )
}
