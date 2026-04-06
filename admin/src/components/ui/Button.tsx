import { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  loading?: boolean
  children: ReactNode
}

export function Button({ variant = 'primary', loading, disabled, children, className = '', ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-semibold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border-0'
  const variants = {
    primary: 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:opacity-85',
    ghost: 'bg-transparent text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text)] hover:border-[var(--text-muted)]',
    danger: 'bg-transparent text-red-400 border border-red-900 hover:bg-red-900/20',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={disabled || loading} {...props}>
      {loading ? <span className="animate-spin mr-2">⟳</span> : null}
      {children}
    </button>
  )
}
