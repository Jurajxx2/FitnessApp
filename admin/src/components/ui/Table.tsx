import { ReactNode } from 'react'

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">{children}</table>
    </div>
  )
}

export function Th({ children }: { children: ReactNode }) {
  return (
    <th className="text-left text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider pb-3 pr-4 border-b border-[var(--border)]">
      {children}
    </th>
  )
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <td className={`text-sm text-[var(--text-muted)] py-3 pr-4 border-b border-[var(--border-subtle)] ${className}`}>
      {children}
    </td>
  )
}
