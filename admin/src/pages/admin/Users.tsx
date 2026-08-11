// admin/src/pages/admin/Users.tsx
import { useDeferredValue, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Badge, Button, Chip, DataTable, EmptyState, PageHeader, SearchInput } from '../../components/ui'
import type { DataColumn, ActionMenuItem } from '../../components/ui'
import type { Profile } from '../../types/database'
import { useAuth } from '../../hooks/useAuth'
import { PROFILE_SELECT } from '../../profile/selects'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

function useUsers(search: string, status: 'all' | 'active' | 'inactive' | 'blocked', page: number, pageSize: number) {
  return useQuery<{ data: Profile[]; count: number }>({
    queryKey: ['admin-users', search, status, page, pageSize],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select(PROFILE_SELECT, { count: 'exact' })
        .order('created_at', { ascending: false })
        .order('id')
        .range(page * pageSize, page * pageSize + pageSize - 1)
      if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
      if (status === 'blocked') query = query.eq('is_blocked', true)
      if (status === 'inactive') query = query.eq('is_blocked', false).eq('onboarding_complete', false)
      if (status === 'active') query = query.eq('is_blocked', false).eq('onboarding_complete', true)
      const { data, count, error } = await query
      if (error) throw error
      return { data: data ?? [], count: count ?? 0 }
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

const ACCESS_LABELS = {
  both: 'Nutrition + activity',
  nutrition: 'Nutrition only',
  activity: 'Activity only',
} as const

export default function Users() {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim())
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'blocked'>('all')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const { data: { data: users = [], count: totalCount = 0 } = {}, isLoading, isError } = useUsers(deferredSearch, statusFilter, page, pageSize)
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()

  function openUser(userId: string) {
    navigate(`/admin/users/${userId}`)
  }

  const columns: DataColumn<Profile>[] = [
    {
      key: 'user',
      header: 'User',
      className: 'text-text-primary',
      render: (user) => (
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-surface-highest text-xs font-bold uppercase text-text-secondary">
            {(user.full_name ?? user.email).slice(0, 2)}
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">{user.full_name ?? '—'}</p>
            <p className="text-xs text-text-secondary">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (user) => (
        <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${user.is_admin ? 'bg-accent/15 text-accent' : 'bg-surface-highest text-text-secondary'}`}>
          {user.id === currentUser?.id ? (user.is_admin ? 'Admin · You' : 'You') : (user.is_admin ? 'Admin' : 'Athlete')}
        </span>
      ),
    },
    { key: 'goal', header: 'Goal', render: (user) => (user.goal ? (GOAL_LABELS[user.goal] ?? user.goal) : '—') },
    {
      key: 'access',
      header: 'Access',
      render: (user) => <span className="whitespace-nowrap text-xs font-semibold text-text-primary">{ACCESS_LABELS[user.access_mode ?? 'both']}</span>,
    },
    { key: 'status', header: 'Status', render: (user) => <Badge status={deriveStatus(user)} /> },
    { key: 'joined', header: 'Joined', render: (user) => new Date(user.created_at).toLocaleDateString() },
  ]

  const rowActions = (user: Profile): ActionMenuItem[] => [
    { key: 'open', label: 'Open', onSelect: () => openUser(user.id) },
  ]

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Users"
        description={`${totalCount} matching users`}
        actions={<Button onClick={() => navigate('/admin/users/new')}>Create athlete</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          placeholder="Search by name or email…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
          onClear={() => { setSearch(''); setPage(0) }}
          className="w-full sm:max-w-sm"
        />
        <div className="flex flex-wrap gap-2" aria-label="Filter users by status">
          {(['all', 'active', 'inactive', 'blocked'] as const).map(status => (
            <Chip key={status} size="sm" selected={statusFilter === status} onClick={() => { setStatusFilter(status); setPage(0) }} className="capitalize">
              {status}
            </Chip>
          ))}
        </div>
      </div>

      {isError ? (
        <EmptyState title="Users couldn’t be loaded" description="Refresh the page to retry the request." />
      ) : (
        <>
          {!isLoading && users.length > 0 && (
            <p className="mb-3 text-sm text-text-secondary">Showing {users.length} of {totalCount} users</p>
          )}
          <DataTable<Profile>
            rows={users}
            getRowId={(user) => user.id}
            columns={columns}
            rowLabel={(user) => `Open ${user.full_name ?? user.email}`}
            onRowActivate={(user) => openUser(user.id)}
            rowActions={rowActions}
            serverPagination
            page={page}
            pageSize={pageSize}
            totalItems={totalCount}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={setPage}
            onPageSizeChange={size => { setPageSize(size); setPage(0) }}
            loading={isLoading}
            empty={
              <EmptyState
                title={search || statusFilter !== 'all' ? 'No users match these filters' : 'No users yet'}
                description={search || statusFilter !== 'all' ? 'Try a different name, email, or status filter.' : 'New accounts will appear here once they join.'}
              />
            }
          />
        </>
      )}
    </div>
  )
}
