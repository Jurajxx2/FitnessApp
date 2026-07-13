import { InputHTMLAttributes, useId } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = error ? `${inputId}-error` : undefined

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`h-10 w-full rounded-xl border border-outline bg-surface px-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-secondary focus:border-accent ${error ? 'border-error focus:border-error' : ''} ${className}`}
        {...props}
      />
      {error && <p id={errorId} className="text-xs text-error">{error}</p>}
    </div>
  )
}
