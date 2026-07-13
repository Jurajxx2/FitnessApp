// admin/src/pages/admin/ImportExercisesModal.tsx
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Modal, Button } from '../../components/ui'
import { logger } from '../../lib/logger'
import { loggingFetch } from '../../lib/loggingFetch'
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

type SyncMode = 'full' | 'photos'

export default function ImportExercisesModal({ open, onClose }: ImportExercisesModalProps) {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [uploadImages, setUploadImages] = useState(true)
  const [aiTranslate, setAiTranslate] = useState(false)
  const [syncMode, setSyncMode] = useState<SyncMode>('full')

  async function translateText(text: string): Promise<string | null> {
    try {
      const { data, error } = await supabase.functions.invoke('translate-exercise', {
        body: { text }
      })
      if (error) throw error
      return data.translatedText
    } catch (e) {
      logger.warn('Exercise translation failed', e)
      return null
    }
  }

  async function uploadImageToSupabase(githubUrl: string, fileName: string): Promise<string | null> {
    try {
      const res = await loggingFetch(githubUrl)
      if (!res.ok) return null
      const blob = await res.blob()
      
      const filePath = `${fileName}`
      const { error: uploadError } = await supabase.storage
        .from('exercises')
        .upload(filePath, blob, { upsert: true, contentType: 'image/jpeg' })

      if (uploadError) {
        logger.warn('Exercise image upload failed', { fileName, error: uploadError })
        return null
      }

      const { data: { publicUrl } } = supabase.storage.from('exercises').getPublicUrl(filePath)
      return publicUrl
    } catch (e) {
      logger.error('Exercise image proxy failed', { fileName, error: e })
      return null
    }
  }

  async function startImport() {
    setLoading(true)
    setStatus('Fetching data from repository...')
    try {
      const res = await loggingFetch(JSON_URL)
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

          let nameCs: string | null = null
          let descCs: string | null = null
          if (aiTranslate) {
            nameCs = await translateText(ex.name)
            if (ex.instructions) {
               descCs = await translateText(Array.isArray(ex.instructions) ? ex.instructions.join('\n\n') : ex.instructions)
            }
          }

          return {
            name_en: ex.name,
            description_en: Array.isArray(ex.instructions) ? ex.instructions.join('\n\n') : '',
            ...(nameCs ? { name_cs: nameCs } : {}),
            ...(descCs ? { description_cs: descCs } : {}),
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

  async function startPhotoSync() {
    setLoading(true)
    setStatus('Fetching source data...')
    try {
      const res = await loggingFetch(JSON_URL)
      if (!res.ok) throw new Error('Failed to fetch source data')
      const exercises: any[] = await res.json()

      const withSecondImage = exercises.filter(ex => ex.images?.[1])
      setProgress({ current: 0, total: withSecondImage.length })
      setStatus(`Found ${withSecondImage.length} exercises with a second photo`)

      const batchSize = 5
      for (let i = 0; i < withSecondImage.length; i += batchSize) {
        const batch = withSecondImage.slice(i, i + batchSize)
        setStatus(`Uploading photos ${i + 1}–${Math.min(i + batchSize, withSecondImage.length)} of ${withSecondImage.length}…`)

        const results = await Promise.all(batch.map(async (ex: any) => {
          const githubUrl = `${IMAGE_BASE_URL}${ex.images[1]}`
          const fileName = `${ex.id}_2.jpg`
          const publicUrl = await uploadImageToSupabase(githubUrl, fileName)
          if (!publicUrl) return false

          const { error } = await supabase
            .from('exercises')
            .update({ image_url_2: publicUrl })
            .eq('external_id', ex.id)
            .eq('source_provider', 'yuhonas')
          return !error
        }))

        const failed = results.filter(result => !result).length
        if (failed > 0) throw new Error(`${failed} photo update${failed === 1 ? '' : 's'} failed in this batch`)

        setProgress(p => ({ ...p, current: Math.min(i + batchSize, withSecondImage.length) }))
      }

      setStatus('Done! Photos synced.')
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
        <div className="flex gap-2">
          {(['full', 'photos'] as SyncMode[]).map(mode => (
            <button
              key={mode}
              type="button"
              disabled={loading}
              onClick={() => setSyncMode(mode)}
              className={`flex-1 cursor-pointer rounded-xl border px-3 py-2 text-sm transition-colors ${
                syncMode === mode
                  ? 'border-transparent bg-accent text-on-accent'
                  : 'border-outline bg-surface text-text-secondary hover:bg-surface-elevated'
              }`}
            >
              {mode === 'full' ? 'Full sync' : 'Photos only'}
            </button>
          ))}
        </div>

        {syncMode === 'full' ? (
          <>
            <p className="text-sm text-text-secondary">
              Sync all exercises from <strong>free-exercise-db</strong> (~800 exercises). Existing records are updated by external ID.
            </p>
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-outline bg-surface p-3">
                <input
                  type="checkbox"
                  checked={uploadImages}
                  onChange={e => setUploadImages(e.target.checked)}
                  disabled={loading}
                />
                <span className="text-sm font-medium">Upload images to Supabase Storage</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-outline bg-surface p-3">
                <input
                  type="checkbox"
                  checked={aiTranslate}
                  onChange={e => setAiTranslate(e.target.checked)}
                  disabled={loading}
                />
                <span className="text-sm font-medium">Translate to Czech (AI) — much slower!</span>
              </label>
            </div>
          </>
        ) : (
          <p className="text-sm text-text-secondary">
            Downloads the <strong>second photo</strong> for each exercise that has one and saves it to <code>image_url_2</code>. Only touches photo fields — no metadata changes.
          </p>
        )}

        {status && (
          <div className="rounded-xl border border-outline bg-surface p-3">
            <p className="mb-2 font-mono text-xs text-text-secondary">{status}</p>
            {progress.total > 0 && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-highest">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            variant="primary"
            onClick={syncMode === 'full' ? startImport : startPhotoSync}
            loading={loading}
          >
            {syncMode === 'full' ? 'Start Sync' : 'Sync Photos'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
