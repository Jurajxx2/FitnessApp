// admin/src/pages/admin/RecipePhotoUploadModal.tsx
import { useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { uploadRecipePhoto } from '../../lib/storage'
import { Button, Modal, Table, Th, Td } from '../../components/ui'

interface Props {
  open: boolean
  onClose: () => void
}

interface FileMatch {
  file: File
  recipeId: string | null
  recipeName: string | null
}

export default function RecipePhotoUploadModal({ open, onClose }: Props) {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [matches, setMatches] = useState<FileMatch[]>([])
  const [uploadResult, setUploadResult] = useState<{ uploaded: number; failed: number } | null>(null)

  const { data: recipes = [] } = useQuery({
    queryKey: ['recipes-photo-names'],
    queryFn: async () => {
      const { data } = await supabase.from('recipes').select('id, name, photo_file_name').not('photo_file_name', 'is', null)
      return (data ?? []) as { id: string; name: string; photo_file_name: string }[]
    },
    enabled: open,
  })

  function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setUploadResult(null)

    const fileNameToRecipe = new Map(recipes.map(r => [r.photo_file_name, r]))

    const resolved: FileMatch[] = files.map(file => {
      const recipe = fileNameToRecipe.get(file.name)
      return {
        file,
        recipeId: recipe?.id ?? null,
        recipeName: recipe?.name ?? null,
      }
    })
    setMatches(resolved)
  }

  const uploadMutation = useMutation({
    mutationFn: async () => {
      let uploaded = 0
      let failed = 0
      const matched = matches.filter(m => m.recipeId !== null)

      for (const match of matched) {
        try {
          const url = await uploadRecipePhoto(match.file, match.file.name)
          const { error } = await supabase.from('recipes').update({ photo_url: url }).eq('id', match.recipeId!)
          if (error) throw error
          uploaded++
        } catch {
          failed++
        }
      }
      return { uploaded, failed }
    },
    onSuccess: result => {
      qc.invalidateQueries({ queryKey: ['recipes-admin'] })
      qc.invalidateQueries({ queryKey: ['recipes-photo-names'] })
      setUploadResult(result)
      setMatches([])
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
  })

  function handleClose() {
    setMatches([])
    setUploadResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose()
  }

  const matchedCount = matches.filter(m => m.recipeId !== null).length

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Upload Recipe Photos"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={() => uploadMutation.mutate()}
            loading={uploadMutation.isPending}
            disabled={matchedCount === 0}
          >
            Upload {matchedCount > 0 ? `${matchedCount} photo${matchedCount === 1 ? '' : 's'}` : ''}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs text-[var(--text-muted)]">
          Select image files. Each file will be matched to a recipe by its <span className="font-mono">photo_file_name</span> field.
        </p>

        <div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onFilesSelected} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-[var(--border)] rounded-lg p-6 text-center text-sm text-[var(--text-muted)] hover:border-[var(--text-disabled)] hover:text-[var(--text)] bg-transparent cursor-pointer transition-colors"
          >
            Click to select images
          </button>
        </div>

        {uploadResult && (
          <div className="rounded-lg p-3 bg-[var(--bg)] border border-[var(--border)] text-sm">
            <span className="text-green-400">{uploadResult.uploaded} uploaded</span>
            {uploadResult.failed > 0 && <span className="text-red-400 ml-3">{uploadResult.failed} failed</span>}
          </div>
        )}

        {matches.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>File</Th><Th>Status</Th><Th>Recipe</Th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, i) => (
                  <tr key={i}>
                    <Td className="font-mono text-xs">{m.file.name}</Td>
                    <Td>
                      {m.recipeId
                        ? <span className="text-green-400 text-xs">Matched</span>
                        : <span className="text-red-400 text-xs">No match</span>
                      }
                    </Td>
                    <Td className="text-[var(--text-muted)]">{m.recipeName ?? '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {matches.some(m => m.recipeId === null) && (
              <p className="text-xs text-[var(--text-disabled)] mt-2">
                Unmatched files will be skipped. Set <span className="font-mono">photo_file_name</span> on those recipes first.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
