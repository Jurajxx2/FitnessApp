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
    <div className="rounded-2xl border border-dashed border-outline bg-surface p-10 text-center">
      {icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-outline-subtle bg-surface-elevated text-text-secondary">
          {icon}
        </div>
      )}
      <p className="font-display text-base font-bold text-text-primary">{title}</p>
      {supportingText && <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-text-secondary">{supportingText}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}
