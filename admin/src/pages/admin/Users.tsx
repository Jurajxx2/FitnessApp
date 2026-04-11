// admin/src/pages/admin/Users.tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Badge, Input, Table, Th, Td } from '../../components/ui'
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
  weight_loss: 'Weight loss',
  muscle_gain: 'Muscle gain',
  mental_strength: 'Mental strength',
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
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-[var(--text)]">
          Users <span className="text-sm text-[var(--text-disabled)] font-normal ml-2">{users.length} total</span>
        </h1>
      </div>

      <div className="mb-4 w-full sm:max-w-xs">
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--text-disabled)]">Loading…</p>
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
              <tr key={user.id} className="hover:bg-[var(--bg-card-hover)] cursor-pointer" onClick={() => navigate(`/admin/users/${user.id}`)}>
                <Td className="text-[var(--text)]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[var(--bg-card)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] flex-shrink-0 uppercase">
                      {(user.full_name ?? user.email).slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">{user.full_name ?? '—'}</p>
                      <p className="text-xs text-[var(--text-disabled)]">{user.email}</p>
                    </div>
                  </div>
                </Td>
                <Td>{user.goal ? (GOAL_LABELS[user.goal] ?? user.goal) : '—'}</Td>
                <Td><Badge status={deriveStatus(user)} /></Td>
                <Td>{new Date(user.created_at).toLocaleDateString()}</Td>
                <Td><span className="text-xs text-[var(--text-disabled)]">View →</span></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}
