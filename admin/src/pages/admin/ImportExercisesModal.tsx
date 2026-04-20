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
  'strength': 10,
  'stretching': 11,
  'cardio': 12,
  'powerlifting': 10,
  'strongman': 10,
  'plyometrics': 10,
  'yoga': 11
}

const EQUIPMENT_MAP: Record<string, number> = {
  'barbell': 1, 'dumbbell': 3, 'kettlebells': 10, 'machine': 8, 'cable': 4,
  'body only': 7, 'medicine ball': 11, 'bands': 12, 'exercise ball': 13,
  'e-z curl bar': 2, 'foam roll': 14
}

const MUSCLE_MAP: Record<string, number> = {
  'abdominals': 14, 'abductors': 12, 'adductors': 13, 'biceps': 1, 'calves': 7,
  'chest': 4, 'forearms': 10, 'glutes': 11, 'hamstrings': 3, 'lats': 9,
  'lower back': 15, 'middle back': 16, 'traps': 5, 'neck': 17, 'quadriceps': 6,
  'shoulders': 2, 'triceps': 8
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
      const exercises = await res.json()
      setProgress({ current: 0, total: exercises.length })

      // Process in smaller chunks to avoid too many parallel requests
      const batchSize = 10
      for (let i = 0; i < exercises.length; i += batchSize) {
        const batch = exercises.slice(i, i + batchSize)
        setStatus(`Importing batch ${Math.floor(i / batchSize) + 1}...`)
        
        await Promise.all(batch.map(async (ex: any) => {
          const imagePath = ex.images?.[0] ? `${IMAGE_BASE_URL}${ex.images[0]}` : null

          // 1. Upsert Exercise
          const { data: exerciseRow, error: exError } = await supabase
            .from('exercises')
            .upsert({
              name_en: ex.name,
              description_en: ex.instructions.join('\n\n'),
              category_id: CATEGORY_MAP[ex.category] || 10,
              image_url: imagePath,
              difficulty: ex.level,
              force: ex.force,
              mechanic: ex.mechanic,
              is_active: true
            }, { onConflict: 'name_en' })
            .select('id')
            .single()

          if (exError || !exerciseRow) return

          const exerciseId = exerciseRow.id

          // 2. Muscles
          const muscles = [
            ...(ex.primaryMuscles || []).map((m: string) => ({ exercise_id: exerciseId, muscle_id: MUSCLE_MAP[m], is_primary: true })),
            ...(ex.secondaryMuscles || []).map((m: string) => ({ exercise_id: exerciseId, muscle_id: MUSCLE_MAP[m], is_primary: false })),
          ].filter(m => m.muscle_id)

          if (muscles.length > 0) {
            await supabase.from('exercise_muscles').upsert(muscles)
          }

          // 3. Equipment
          if (ex.equipment && EQUIPMENT_MAP[ex.equipment]) {
            await supabase.from('exercise_equipment').upsert({
              exercise_id: exerciseId,
              equipment_id: EQUIPMENT_MAP[ex.equipment]
            })
          }
        }))
        
        setProgress(p => ({ ...p, current: Math.min(i + batchSize, p.total) }))
      }

      setStatus('Success! Refreshing list...')
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
          This will sync exercises from the <strong>free-exercise-db</strong> repository.
          Existing exercises will be updated based on their English name.
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
