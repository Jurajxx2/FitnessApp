import { ButtonHTMLAttributes } from 'react'

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
}

export function Chip({ selected = false, className = '', children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={`h-9 rounded-full border px-3 text-sm font-medium transition-colors cursor-pointer ${selected ? 'border-transparent bg-action-primary text-on-action-primary' : 'border-outline bg-surface text-text-secondary hover:bg-surface-elevated'} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
