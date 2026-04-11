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
      <div className={`relative z-10 w-full sm:max-w-lg bg-[var(--bg-card)] border-l border-[var(--border)] h-full overflow-y-auto flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-5 border-b border-[var(--border)] sticky top-0 bg-[var(--bg-card)]">
          <h2 className="text-base font-bold text-[var(--text)]">{title}</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer border-0 bg-transparent text-xl leading-none">×</button>
        </div>
        <div className="px-4 sm:px-6 py-6 flex-1">{children}</div>
      </div>
    </div>
  )
}
