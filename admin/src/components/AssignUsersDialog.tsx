import { useState, useEffect } from 'react'
import { Modal, Input, Button, Chip } from './ui'
import type { Profile } from '../types/database'

type AssignableProfile = Pick<Profile, 'id' | 'email' | 'full_name' | 'is_admin' | 'is_blocked'>

// Only non-admin, non-blocked athletes may be NEWLY assigned. A user assigned
// before being blocked stays removable (handled at the call site via localIds).
function isAssignable(profile: AssignableProfile) {
  return !profile.is_admin && !profile.is_blocked
}

export function AssignUsersDialog({
  open,
  onClose,
  profiles,
  value,
  onChange,
}: {
  open: boolean
  onClose: () => void
  profiles: Pick<Profile, 'id' | 'email' | 'full_name' | 'is_admin' | 'is_blocked'>[]
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
      // Show a profile if it is currently assigned (so a user blocked AFTER
      // being assigned stays visible and removable) OR if it is assignable.
      if (!localIds.has(p.id) && !isAssignable(p)) return false
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
      if (next.has(id)) {
        next.delete(id)
      } else {
        // Never newly-assign a blocked/admin profile.
        const profile = profiles.find(p => p.id === id)
        if (profile && !isAssignable(profile)) return prev
        next.add(id)
      }
      return next
    })
    setPage(0)
  }

  function setFilteredAssignments(assign: boolean) {
    setLocalIds(previous => {
      const next = new Set(previous)
      filtered.forEach(profile => {
        // Bulk-assign only adds assignable users (already-assigned blocked users
        // stay assigned); clearing removes anything shown, blocked users included.
        if (assign) {
          if (isAssignable(profile) || next.has(profile.id)) next.add(profile.id)
        } else {
          next.delete(profile.id)
        }
      })
      return next
    })
  }

  const allFilteredAssigned = filtered.length > 0 && filtered.every(profile => localIds.has(profile.id))

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
              size="sm"
            >
              {f === 'all' ? 'All' : 'Assigned only'}
            </Chip>
          ))}
        </div>
        {filtered.length > 0 && (
          <button
            type="button"
            onClick={() => setFilteredAssignments(!allFilteredAssigned)}
            className="self-start cursor-pointer border-0 bg-transparent p-0 text-xs font-medium text-text-primary hover:text-text-secondary"
          >
            {allFilteredAssigned ? 'Clear shown users' : `Assign all ${filtered.length} shown`}
          </button>
        )}
        <div className="flex flex-col divide-y divide-[var(--border)]">
          {pageItems.map(p => {
            const isAssigned = localIds.has(p.id)
            // A rendered non-assignable row (blocked/admin) is only here because
            // it's already assigned: allow removing it, never newly checking it.
            const disabled = !isAssigned && !isAssignable(p)
            return (
              <div
                key={p.id}
                onClick={() => { if (!disabled) toggle(p.id) }}
                aria-disabled={disabled}
                className={`-mx-1 flex items-center gap-3 rounded-xl px-1 py-2.5 ${
                  disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                } ${
                  isAssigned ? 'bg-surface-elevated hover:bg-surface-highest' : 'hover:bg-surface-elevated'
                }`}
              >
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isAssigned ? 'bg-success/15 text-success' : 'bg-surface text-text-secondary'
                }`}>
                  {(p.full_name ?? p.email)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="flex items-center gap-1.5 text-sm text-text-primary">
                    <span className="truncate">{p.full_name ?? '—'}</span>
                    {p.is_blocked && (
                      <span className="flex-shrink-0 rounded bg-error/10 px-1.5 py-0.5 text-[10px] font-medium text-error">Blocked</span>
                    )}
                  </p>
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
