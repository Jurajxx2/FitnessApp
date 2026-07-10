import { useState, useEffect } from 'react'
import { Modal, Input, Button, Chip } from './ui'
import type { Profile } from '../types/database'

export function AssignUsersDialog({
  open,
  onClose,
  profiles,
  value,
  onChange,
}: {
  open: boolean
  onClose: () => void
  profiles: Pick<Profile, 'id' | 'email' | 'full_name'>[]
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const [filterAssigned, setFilterAssigned] = useState(false)
  const [page, setPage] = useState(0)
  const [localIds, setLocalIds] = useState<Set<string>>(new Set(value))

  useEffect(() => {
    if (open) {
      setLocalIds(new Set(value))
      setSearch('')
      setFilterAssigned(false)
      setPage(0)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const PAGE_SIZE = 10

  const filtered = profiles
    .filter(p => {
      if (filterAssigned && !localIds.has(p.id)) return false
      if (search) {
        const q = search.toLowerCase()
        return (p.full_name?.toLowerCase().includes(q) ?? false) || p.email.toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => {
      const aA = localIds.has(a.id) ? 0 : 1
      const bA = localIds.has(b.id) ? 0 : 1
      return aA - bA
    })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function toggle(id: string) {
    setLocalIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setPage(0)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign Users"
      footer={
        <>
          <span className="text-xs text-text-secondary">{localIds.size} assigned</span>
          <Button onClick={() => { onChange([...localIds]); onClose() }}>Done</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input
          placeholder="Search users…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
        />
        <div className="flex gap-2">
          {(['all', 'assigned'] as const).map(f => (
            <Chip
              key={f}
              onClick={() => { setFilterAssigned(f === 'assigned'); setPage(0) }}
              selected={(f === 'assigned') === filterAssigned}
              className="h-8 text-xs"
            >
              {f === 'all' ? 'All' : 'Assigned only'}
            </Chip>
          ))}
        </div>
        <div className="flex flex-col divide-y divide-[var(--border)]">
          {pageItems.map(p => {
            const isAssigned = localIds.has(p.id)
            return (
              <div
                key={p.id}
                onClick={() => toggle(p.id)}
                className={`-mx-1 flex cursor-pointer items-center gap-3 rounded-xl px-1 py-2.5 ${
                  isAssigned ? 'bg-surface-elevated hover:bg-surface-highest' : 'hover:bg-surface-elevated'
                }`}
              >
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isAssigned ? 'bg-success/15 text-success' : 'bg-surface text-text-secondary'
                }`}>
                  {(p.full_name ?? p.email)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm text-text-primary">{p.full_name ?? '—'}</p>
                  <p className="truncate text-xs text-text-secondary">{p.email}</p>
                </div>
                <div className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                  isAssigned ? 'border-success bg-success/15' : 'border-outline'
                }`}>
                  {isAssigned && <span className="text-[10px] text-success">✓</span>}
                </div>
              </div>
            )
          })}
          {pageItems.length === 0 && (
            <p className="py-4 text-center text-sm text-text-secondary">No users found</p>
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="cursor-pointer rounded border border-outline bg-surface px-2 py-1 disabled:opacity-30"
              >
                ←
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="cursor-pointer rounded border border-outline bg-surface px-2 py-1 disabled:opacity-30"
              >
                →
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
