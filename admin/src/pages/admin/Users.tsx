// admin/src/pages/admin/Users.tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, Outlet } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Badge, Button, Chip, EmptyState, PageHeader, SearchInput, Table, Th, Td } from '../../components/ui'
import type { Profile } from '../../types/database'
import { CreateUserModal } from './CreateUserModal'

function useUsers() {
  return useQuery<Profile[]>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

function deriveStatus(p: Profile): 'active' | 'inactive' | 'blocked' {
  if (p.is_blocked) return 'blocked'
  if (!p.onboarding_complete) return 'inactive'
  return 'active'
}

const GOAL_LABELS: Record<string, string> = {
  build_muscle: 'Build muscle',
  lose_weight: 'Lose weight',
  stay_fit: 'Stay fit',
  get_stronger: 'Get stronger',
}

export default function Users() {
  const { data: users = [], isLoading, isError } = useUsers()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'blocked'>('all')
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false)
  const navigate = useNavigate()

  const trainees = users.filter(user => !user.is_admin)
  const filtered = trainees.filter(u => {
    const q = search.toLowerCase()
    const matchesSearch = u.full_name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'all' || deriveStatus(u) === statusFilter
    return matchesSearch && matchesStatus
  })

  function openUser(userId: string) {
    navigate(`/admin/users/${userId}`)
  }

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Users"
        description={`${trainees.length} athletes`}
        actions={<Button onClick={() => setIsCreateUserOpen(true)}>Create athlete</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          className="w-full sm:max-w-sm"
        />
        <div className="flex flex-wrap gap-2" aria-label="Filter users by status">
          {(['all', 'active', 'inactive', 'blocked'] as const).map(status => (
            <Chip key={status} size="sm" selected={statusFilter === status} onClick={() => setStatusFilter(status)} className="capitalize">
              {status}
            </Chip>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : isError ? (
        <EmptyState title="Users couldn’t be loaded" description="Refresh the page to retry the request." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search || statusFilter !== 'all' ? 'No users match these filters' : 'No athletes yet'}
          description={search || statusFilter !== 'all' ? 'Try a different name, email, or status filter.' : 'New athlete accounts will appear here once they join.'}
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-text-secondary">Showing {filtered.length} of {trainees.length} athletes</p>
          <Table>
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Goal</Th>
                <Th>Status</Th>
                <Th>Joined</Th>
                <Th>{''}</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => (
                <tr
                  key={user.id}
                  tabIndex={0}
                  className="cursor-pointer outline-none hover:bg-surface-highest focus-visible:bg-surface-highest"
                  onClick={() => openUser(user.id)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openUser(user.id)
                    }
                  }}
                >
                  <Td className="text-text-primary">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-surface-highest text-xs font-bold uppercase text-text-secondary">
                        {(user.full_name ?? user.email).slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{user.full_name ?? '—'}</p>
                        <p className="text-xs text-text-secondary">{user.email}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>{user.goal ? (GOAL_LABELS[user.goal] ?? user.goal) : '—'}</Td>
                  <Td><Badge status={deriveStatus(user)} /></Td>
                  <Td>{new Date(user.created_at).toLocaleDateString()}</Td>
                  <Td><span className="text-xs font-medium text-text-primary">Open →</span></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
      <CreateUserModal
        open={isCreateUserOpen}
        onClose={() => setIsCreateUserOpen(false)}
        onCreated={userId => {
          setIsCreateUserOpen(false)
          navigate(`/admin/users/${userId}`)
        }}
      />
      <Outlet />
    </div>
  )
}
