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

// Normalization helper
const normalize = (items: string[] | string | null): string[] => {
  if (!items) return []
  const arr = Array.isArray(items) ? items : [items]
  return arr
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
}

export default function ImportExercisesModal({ open, onClose }: ImportExercisesModalProps) {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [uploadImages, setUploadImages] = useState(true)
  const [aiTranslate, setAiTranslate] = useState(false)

  async function translateText(text: string): Promise<string | null> {
    try {
      const { data, error } = await supabase.functions.invoke('translate-exercise', {
        body: { text }
      })
      if (error) throw error
      return data.translatedText
    } catch (e) {
      console.warn('Translation failed:', e)
      return null
    }
  }

  async function uploadImageToSupabase(githubUrl: string, fileName: string): Promise<string | null> {
    try {
      const res = await fetch(githubUrl)
      if (!res.ok) return null
      const blob = await res.blob()
      
      const filePath = `${fileName}`
      const { error: uploadError } = await supabase.storage
        .from('exercises')
        .upload(filePath, blob, { upsert: true, contentType: 'image/jpeg' })

      if (uploadError) {
        console.warn(`Failed to upload ${fileName}:`, uploadError)
        return null
      }

      const { data: { publicUrl } } = supabase.storage.from('exercises').getPublicUrl(filePath)
      return publicUrl
    } catch (e) {
      console.error(`Error proxying ${fileName}:`, e)
      return null
    }
  }

  async function startImport() {
    setLoading(true)
    setStatus('Fetching data from repository...')
    try {
      const res = await fetch(JSON_URL)
      if (!res.ok) throw new Error('Failed to fetch source data')
      const exercises: any[] = await res.json()
      setProgress({ current: 0, total: exercises.length })

      const batchSize = (uploadImages || aiTranslate) ? 5 : 50 
      for (let i = 0; i < exercises.length; i += batchSize) {
        const batch = exercises.slice(i, i + batchSize)
        let statusMsg = `Importing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(exercises.length / batchSize)}…`
        if (uploadImages) statusMsg += ' (Images)'
        if (aiTranslate) statusMsg += ' (AI Translating)'
        setStatus(statusMsg)

        const rows = await Promise.all(batch.map(async (ex: any) => {
          let imageUrl = ex.images?.[0] ? `${IMAGE_BASE_URL}${ex.images[0]}` : null
          
          if (uploadImages && imageUrl) {
            const fileName = `${ex.id}.jpg`
            const localUrl = await uploadImageToSupabase(imageUrl, fileName)
            if (localUrl) imageUrl = localUrl
          }

          let nameCs = null
          let descCs = null
          if (aiTranslate) {
            nameCs = await translateText(ex.name)
            if (ex.instructions) {
               descCs = await translateText(Array.isArray(ex.instructions) ? ex.instructions.join('\n\n') : ex.instructions)
            }
          }

          return {
            name_en: ex.name,
            description_en: Array.isArray(ex.instructions) ? ex.instructions.join('\n\n') : '',
            name_cs: nameCs,
            description_cs: descCs,
            category_id: CATEGORY_MAP[ex.category?.toLowerCase()] ?? 10,
            image_url: imageUrl,
            difficulty: ex.level ?? null,
            force: ex.force ?? null,
            mechanic: ex.mechanic ?? null,
            primary_muscles: normalize(ex.primaryMuscles),
            secondary_muscles: normalize(ex.secondaryMuscles),
            equipment_names: normalize(ex.equipment),
            is_active: true,
            external_id: ex.id, // yuhonas slug
            source_provider: 'yuhonas',
          }
        }))

        const { error } = await supabase.from('exercises').upsert(rows, { onConflict: 'external_id, source_provider' })
        if (error) throw error

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
          Existing exercises are updated by external ID.
        </p>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer p-2 bg-zinc-900/50 rounded-md border border-zinc-800">
            <input 
              type="checkbox" 
              checked={uploadImages} 
              onChange={e => setUploadImages(e.target.checked)}
              disabled={loading}
            />
            <span className="text-sm font-medium">Upload images to Supabase Storage</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer p-2 bg-zinc-900/50 rounded-md border border-zinc-800">
            <input 
              type="checkbox" 
              checked={aiTranslate} 
              onChange={e => setAiTranslate(e.target.checked)}
              disabled={loading}
            />
            <span className="text-sm font-medium">Translate to Czech (AI) — much slower!</span>
          </label>
        </div>

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
