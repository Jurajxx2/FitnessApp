import { ButtonHTMLAttributes } from 'react'

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
  size?: 'sm' | 'md'
  variant?: 'primary' | 'accent'
}

const SIZE = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-3 text-sm',
} as const

export function Chip({ selected = false, size = 'md', variant = 'primary', className = '', children, ...props }: ChipProps) {
  const selectedCls =
    variant === 'accent'
      ? 'border-transparent bg-accent text-on-accent'
      : 'border-transparent bg-action-primary text-on-action-primary'
  return (
    <button
      type="button"
      className={`${SIZE[size]} rounded-full border font-medium transition-colors cursor-pointer ${selected ? selectedCls : 'border-outline bg-surface text-text-secondary hover:bg-surface-elevated'} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
