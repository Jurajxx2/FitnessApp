import { ReactNode } from 'react'

export function EmptyState({
  icon,
  title,
  description,
  message,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  message?: string
  action?: ReactNode
}) {
  const supportingText = description ?? message
  return (
    <div className="rounded-2xl border border-dashed border-outline bg-surface p-8 text-center">
      {icon && <div className="mb-3 flex justify-center text-text-secondary">{icon}</div>}
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      {supportingText && <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-text-secondary">{supportingText}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
