import { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  loading?: boolean
  children: ReactNode
}

export function Button({ variant = 'primary', loading, disabled, children, className = '', ...props }: ButtonProps) {
  const base = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-[background-color,color,border-color,opacity,transform] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer border'
  const variants = {
    primary: 'border-transparent bg-action-primary text-on-action-primary hover:opacity-85',
    secondary: 'border-transparent bg-action-secondary text-on-action-secondary hover:bg-surface-highest',
    ghost: 'border-outline bg-transparent text-text-primary hover:bg-surface-elevated',
    danger: 'border-error/40 bg-error/10 text-error hover:bg-error/20',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <span className="animate-spin" aria-hidden="true">⟳</span> : null}
      {children}
    </button>
  )
}
