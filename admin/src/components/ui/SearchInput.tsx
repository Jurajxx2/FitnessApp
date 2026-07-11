import { InputHTMLAttributes } from 'react'
import { Search, X } from 'lucide-react'

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onClear?: () => void
}

export function SearchInput({ value, onClear, className = '', ...props }: SearchInputProps) {
  const hasValue = typeof value === 'string' && value.length > 0

  return (
    <div className={`relative ${className}`}>
      <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" aria-hidden="true" />
      <input
        type="search"
        value={value}
        className="h-10 w-full rounded-xl border border-outline bg-surface py-2 pl-9 pr-9 text-sm text-text-primary outline-none transition-colors placeholder:text-text-secondary focus:border-accent"
        {...props}
      />
      {hasValue && onClear && (
        <button type="button" aria-label="Clear search" onClick={onClear} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-text-secondary hover:bg-surface-highest hover:text-text-primary">
          <X size={15} />
        </button>
      )}
    </div>
  )
}
