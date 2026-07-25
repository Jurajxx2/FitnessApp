import { ReactNode, useEffect, useId } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const SIZE = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
} as const

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const titleId = useId()
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={`relative z-10 flex max-h-[95vh] w-full ${SIZE[size]} flex-col rounded-2xl border border-outline bg-surface-elevated mx-3 sm:mx-4 sm:max-h-[90vh]`}>
        <div className="flex items-center justify-between border-b border-outline px-4 py-4 sm:px-6">
          <h2 id={titleId} className="font-display text-lg font-bold tracking-tight text-text-primary">{title}</h2>
          <button aria-label="Close dialog" onClick={onClose} className="cursor-pointer border-0 bg-transparent text-xl leading-none text-text-secondary hover:text-text-primary">×</button>
        </div>
        <div className="overflow-y-auto px-4 sm:px-6 py-4 flex-1">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-outline px-4 py-4 sm:px-6">{footer}</div>
        )}
      </div>
    </div>
  )
}
