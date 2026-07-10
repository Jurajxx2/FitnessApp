import React from 'react'
import { cn } from '../../lib/cn'

export function Chip({ selected, onClick, children }: { selected?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 h-9 rounded-full text-sm font-medium border transition-colors',
        selected ? 'bg-action-primary text-on-action-primary border-transparent'
                 : 'bg-surface text-text-secondary border-outline',
      )}
    >
      {children}
    </button>
  )
}
