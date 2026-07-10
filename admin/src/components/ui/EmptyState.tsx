import { ReactNode } from 'react'

export function EmptyState({ icon, title, message, action }: { icon?: ReactNode; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-outline px-6 py-12 text-center">
      {icon && <div className="text-text-secondary">{icon}</div>}
      <p className="text-base font-semibold text-text-primary">{title}</p>
      {message && <p className="max-w-md text-sm text-text-secondary">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
