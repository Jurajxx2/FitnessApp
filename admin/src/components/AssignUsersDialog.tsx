import { useState, useEffect } from 'react'
import { Modal, Input, Button } from './ui'
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
          <span className="text-xs text-[var(--text-muted)]">{localIds.size} assigned</span>
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
            <button
              key={f}
              onClick={() => { setFilterAssigned(f === 'assigned'); setPage(0) }}
              className={`text-xs px-3 py-1 rounded-full border cursor-pointer bg-transparent transition-colors ${
                (f === 'assigned') === filterAssigned
                  ? 'border-[var(--text)] text-[var(--text)]'
                  : 'border-[var(--border)] text-[var(--text-muted)]'
              }`}
            >
              {f === 'all' ? 'All' : 'Assigned only'}
            </button>
          ))}
        </div>
        <div className="flex flex-col divide-y divide-[var(--border)]">
          {pageItems.map(p => {
            const isAssigned = localIds.has(p.id)
            return (
              <div
                key={p.id}
                onClick={() => toggle(p.id)}
                className={`flex items-center gap-3 py-2.5 cursor-pointer rounded px-1 -mx-1 ${
                  isAssigned ? 'bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)]' : 'hover:bg-[var(--bg-card)]'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  isAssigned ? 'bg-green-900/40 text-green-400' : 'bg-[var(--bg)] text-[var(--text-muted)]'
                }`}>
                  {(p.full_name ?? p.email)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text)] truncate">{p.full_name ?? '—'}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{p.email}</p>
                </div>
                <div className={`w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center ${
                  isAssigned ? 'bg-green-900/40 border-green-700' : 'border-[var(--border)]'
                }`}>
                  {isAssigned && <span className="text-green-400 text-[10px]">✓</span>}
                </div>
              </div>
            )
          })}
          {pageItems.length === 0 && (
            <p className="text-sm text-[var(--text-disabled)] py-4 text-center">No users found</p>
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2 py-1 bg-[var(--bg)] border border-[var(--border)] rounded disabled:opacity-30 cursor-pointer"
              >
                ←
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="px-2 py-1 bg-[var(--bg)] border border-[var(--border)] rounded disabled:opacity-30 cursor-pointer"
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
