import React from 'react'

export function EmptyState({ icon, title, message }: { icon?: React.ReactNode; title: string; message?: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-12 px-6">
      {icon && <div className="text-text-secondary">{icon}</div>}
      <p className="text-base font-semibold text-text-primary">{title}</p>
      {message && <p className="text-sm text-text-secondary">{message}</p>}
    </div>
  )
}
