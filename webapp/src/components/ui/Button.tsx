import React from 'react'
import { cn } from '../../lib/cn'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  loading?: boolean
}

export function Button({ variant = 'primary', loading, disabled, className, children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl text-sm font-semibold',
        'transition-opacity disabled:opacity-40 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-action-primary text-on-action-primary',
        variant === 'secondary' && 'bg-action-secondary text-on-action-secondary',
        className,
      )}
    >
      {loading ? '…' : children}
    </button>
  )
}
