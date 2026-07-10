// admin/src/pages/admin/Users.tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, Outlet } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Badge, Input, PageHeader, Table, Th, Td } from '../../components/ui'
import type { Profile } from '../../types/database'

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
  const { data: users = [], isLoading } = useUsers()
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    return (u.full_name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  })

  return (
    <div className="p-4 sm:p-6">
      <PageHeader title="Users" description={`${users.length} total`} />

      <div className="mb-4 w-full sm:max-w-xs">
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : (
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
              <tr key={user.id} className="cursor-pointer hover:bg-surface-highest" onClick={() => navigate(`/admin/users/${user.id}`)}>
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
                <Td><span className="text-xs text-text-secondary">View →</span></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Outlet />
    </div>
  )
}
