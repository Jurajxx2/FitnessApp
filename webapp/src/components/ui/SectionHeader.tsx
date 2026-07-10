import React from 'react'

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-lg font-bold text-text-primary">{title}</h2>
      {action}
    </div>
  )
}
