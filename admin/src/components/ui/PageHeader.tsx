import { ReactNode } from 'react'

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-1 shrink-0 rounded-full bg-accent-strong" aria-hidden="true" />
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">{title}</h1>
        </div>
        {description && <p className="mt-1.5 text-sm text-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
