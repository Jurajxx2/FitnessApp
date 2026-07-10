import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, id, ...rest }: InputProps) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      {label && <span className="text-xs font-medium text-text-secondary">{label}</span>}
      <input
        id={id}
        {...rest}
        className="h-12 px-3 rounded-xl bg-surface-elevated border border-outline text-text-primary
                   outline-none focus:border-text-secondary placeholder:text-text-secondary"
      />
    </label>
  )
}
