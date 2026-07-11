import { ReactNode } from 'react'

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-outline bg-surface p-8 text-center">
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-text-secondary">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
