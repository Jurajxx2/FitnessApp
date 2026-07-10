import { ReactNode } from 'react'

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-outline bg-surface-elevated">
      <table className="w-full border-collapse">{children}</table>
    </div>
  )
}

export function Th({ children }: { children: ReactNode }) {
  return (
    <th className="border-b border-outline px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-secondary first:pl-4">
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
