import type { DragEvent, ReactNode } from 'react'
import { ArrowDown, ArrowUp, ExternalLink, GripVertical, Trash2 } from 'lucide-react'
import { ExerciseThumbnail } from './ExerciseThumbnail'

interface SelectedExerciseCardProps {
  clientId: string
  name: string
  subtitle?: string | null
  imageUrl?: string | null
  imageUrl2?: string | null
  index: number
  total: number
  locale: 'en' | 'sk'
  detailHref?: string | null
  onMove: (toIndex: number) => void
  onDropExercise: (fromClientId: string, toIndex: number) => void
  onRemove: () => void
  children: ReactNode
}

export function SelectedExerciseCard({ clientId, name, subtitle, imageUrl, imageUrl2, index, total, locale, detailHref, onMove, onDropExercise, onRemove, children }: SelectedExerciseCardProps) {
  const copy = locale === 'sk'
    ? { position: 'Pozícia', detail: `Otvoriť detail cviku ${name}`, up: `Posunúť ${name} vyššie`, down: `Posunúť ${name} nižšie`, remove: `Odstrániť ${name}` }
    : { position: 'Position', detail: `Open ${name} exercise details`, up: `Move ${name} up`, down: `Move ${name} down`, remove: `Remove ${name}` }

  function handleDragStart(event: DragEvent<HTMLElement>) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', clientId)
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    const fromClientId = event.dataTransfer.getData('text/plain')
    if (fromClientId) onDropExercise(fromClientId, index)
  }

  return (
    <article onDragOver={event => event.preventDefault()} onDrop={handleDrop} className="rounded-2xl border border-outline-subtle bg-surface p-4">
      <div className="flex items-start gap-3">
        <div draggable onDragStart={handleDragStart} className="mt-3 cursor-grab text-text-secondary" title={`${copy.position} ${index + 1}`} aria-hidden="true"><GripVertical size={18} /></div>
        <ExerciseThumbnail imageUrl={imageUrl} imageUrl2={imageUrl2} name={name} className="h-14 w-14 flex-shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 pt-1">
          <p className="truncate font-bold text-text-primary">{index + 1}. {name || (locale === 'sk' ? 'Nový cvik' : 'New exercise')}</p>
          {subtitle && <p className="mt-1 truncate text-xs text-text-secondary">{subtitle}</p>}
          {detailHref && (
            <a href={detailHref} target="_blank" rel="noreferrer" aria-label={copy.detail} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-text-accent no-underline hover:underline">
              <ExternalLink size={13} /> {locale === 'sk' ? 'Detail cviku' : 'Exercise details'}
            </a>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button type="button" aria-label={copy.up} onClick={() => onMove(index - 1)} disabled={index === 0} className="cursor-pointer rounded-lg border-0 bg-transparent p-2 text-text-secondary hover:bg-surface-highest hover:text-text-primary disabled:cursor-default disabled:opacity-30"><ArrowUp size={16} /></button>
          <button type="button" aria-label={copy.down} onClick={() => onMove(index + 1)} disabled={index === total - 1} className="cursor-pointer rounded-lg border-0 bg-transparent p-2 text-text-secondary hover:bg-surface-highest hover:text-text-primary disabled:cursor-default disabled:opacity-30"><ArrowDown size={16} /></button>
          <button type="button" aria-label={copy.remove} onClick={onRemove} className="cursor-pointer rounded-lg border-0 bg-transparent p-2 text-text-secondary hover:bg-error/10 hover:text-error"><Trash2 size={16} /></button>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </article>
  )
}
