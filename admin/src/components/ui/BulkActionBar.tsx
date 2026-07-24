import { ReactNode } from 'react'
import { Button } from './Button'

export interface BulkAction {
  key: string
  label: string
  icon?: ReactNode
  variant?: 'default' | 'danger'
  onClick: () => void
  disabled?: boolean
}

interface BulkActionBarProps {
  selectedCount: number
  actions: BulkAction[]
  onClear: () => void
}

export function BulkActionBar({ selectedCount, actions, onClear }: BulkActionBarProps) {
  if (selectedCount === 0) return null

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-outline bg-surface-elevated px-4 py-3"
    >
      <span className="text-sm font-semibold text-text-primary">{selectedCount} selected</span>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.key}
            variant={action.variant === 'danger' ? 'danger' : 'secondary'}
            className="min-h-9 px-3"
            disabled={action.disabled}
            onClick={action.onClick}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
      </div>
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        className="ml-auto cursor-pointer text-sm text-text-secondary hover:text-text-primary"
      >
        Clear
      </button>
    </div>
  )
}
