import { InputHTMLAttributes, useEffect, useRef } from 'react'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  checked: boolean
  indeterminate?: boolean
  onChange: (checked: boolean) => void
  label: string
}

export function Checkbox({ checked, indeterminate = false, onChange, label, className = '', ...props }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked
  }, [indeterminate, checked])

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-label={label}
      onChange={(event) => onChange(event.target.checked)}
      className={`h-4 w-4 shrink-0 cursor-pointer rounded border-outline bg-surface accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
      {...props}
    />
  )
}
