import { KeyboardEvent, MouseEvent, ReactNode } from 'react'

export function Table({ children, contained = false }: { children: ReactNode; contained?: boolean }) {
  const table = <table className="w-full border-collapse [&_tbody_tr:last-child_td]:border-b-0">{children}</table>
  if (contained) return <div className="overflow-x-auto">{table}</div>
  return <div className="overflow-x-auto rounded-2xl border border-outline bg-surface-elevated">{table}</div>
}

export function Th({ children }: { children: ReactNode }) {
  return (
    <th scope="col" className="ledger-label border-b border-outline px-4 py-3 text-left text-text-secondary first:pl-4">
      {children}
    </th>
  )
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <td className={`border-b border-outline-subtle px-4 py-3.5 text-sm text-text-secondary last:border-0 ${className}`}>
      {children}
    </td>
  )
}

interface ClickableRowProps {
  children: ReactNode
  label: string
  onActivate: () => void
  className?: string
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('a, button, input, select, textarea, [role="button"]'))
}

export function ClickableRow({ children, label, onActivate, className = '' }: ClickableRowProps) {
  function handleClick(event: MouseEvent<HTMLTableRowElement>) {
    if (!isInteractiveTarget(event.target)) onActivate()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    onActivate()
  }

  return (
    <tr
      tabIndex={0}
      aria-label={label}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`cursor-pointer transition-colors hover:bg-surface-highest focus-visible:bg-surface-highest focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${className}`}
    >
      {children}
    </tr>
  )
}
