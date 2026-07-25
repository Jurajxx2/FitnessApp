import React from 'react'

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2.5 font-display text-lg font-bold text-text-primary">
        <span className="h-4 w-1 shrink-0 rounded-full bg-accent-strong" aria-hidden="true" />
        {title}
      </h2>
      {action}
    </div>
  )
}
