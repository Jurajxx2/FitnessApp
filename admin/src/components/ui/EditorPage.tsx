import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

interface EditorPageProps {
  backTo: string
  backLabel: string
  eyebrow: string
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  aside?: ReactNode
  maxWidth?: '5xl' | '6xl' | '7xl'
}

export function EditorPage({
  backTo,
  backLabel,
  eyebrow,
  title,
  description,
  actions,
  children,
  aside,
  maxWidth = '7xl',
}: EditorPageProps) {
  const widthClass = {
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
  }[maxWidth]

  return (
    <div className={`mx-auto w-full ${widthClass} p-4 pb-24 sm:p-6 sm:pb-8 lg:p-8`}>
      <Link
        to={backTo}
        className="mb-6 inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ArrowLeft size={17} aria-hidden="true" />
        {backLabel}
      </Link>

      <header className="mb-7 flex flex-col gap-5 border-b border-outline-subtle pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.035em] text-text-primary">{title}</h1>
          {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">{description}</p>}
        </div>
        {actions && (
          <div className="fixed inset-x-4 bottom-4 z-30 flex items-center justify-end gap-2 rounded-2xl border border-outline bg-surface-elevated/95 p-3 shadow-2xl backdrop-blur sm:static sm:inset-auto sm:flex sm:flex-shrink-0 sm:flex-wrap sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
            {actions}
          </div>
        )}
      </header>

      {aside ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.34fr)]">
          <div className="min-w-0 space-y-5">{children}</div>
          <aside className="space-y-4 lg:sticky lg:top-6">{aside}</aside>
        </div>
      ) : (
        <div className="space-y-5">{children}</div>
      )}
    </div>
  )
}

export function FormSection({
  title,
  description,
  children,
  className = '',
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-2xl border border-outline bg-surface-elevated p-5 sm:p-6 ${className}`}>
      <div className="mb-5">
        <h2 className="text-base font-bold text-text-primary">{title}</h2>
        {description && <p className="mt-1 text-sm leading-5 text-text-secondary">{description}</p>}
      </div>
      {children}
    </section>
  )
}

export function FormHint({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-5 text-text-secondary">{children}</p>
}
