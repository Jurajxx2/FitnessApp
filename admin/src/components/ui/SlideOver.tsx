import { ReactNode, useEffect } from 'react'

interface SlideOverProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function SlideOver({ open, onClose, title, children }: SlideOverProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <div className={`fixed inset-0 z-50 flex justify-end transition-opacity ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} inert={!open} className={`relative z-10 flex h-full w-full flex-col overflow-y-auto border-l border-outline bg-surface-elevated transition-transform duration-300 sm:max-w-lg ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="sticky top-0 flex items-center justify-between border-b border-outline bg-surface-elevated px-4 py-5 sm:px-6">
          <h2 className="text-base font-bold text-text-primary">{title}</h2>
          <button aria-label="Close panel" onClick={onClose} className="cursor-pointer border-0 bg-transparent text-xl leading-none text-text-secondary hover:text-text-primary">×</button>
        </div>
        <div className="px-4 sm:px-6 py-6 flex-1">{children}</div>
      </div>
    </div>
  )
}
