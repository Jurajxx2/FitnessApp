// admin/src/pages/admin/Dashboard.tsx
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { DailyQuote } from '../../types/database'
import { Button } from '../../components/ui'

function useStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [users, workouts, mealPlans, recipes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('workouts').select('id', { count: 'exact', head: true }),
        supabase.from('meal_plans').select('id', { count: 'exact', head: true }),
        supabase.from('recipes').select('id', { count: 'exact', head: true }),
      ])
      return {
        users: users.count ?? 0,
        workouts: workouts.count ?? 0,
        mealPlans: mealPlans.count ?? 0,
        recipes: recipes.count ?? 0,
      }
    },
  })
}

function useActiveQuote() {
  return useQuery<DailyQuote | null>({
    queryKey: ['active-quote'],
    queryFn: async () => {
      const { data } = await supabase
        .from('daily_quotes')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      return data
    },
  })
}

type ActivityItem =
  | { kind: 'workout'; id: string; userName: string; workoutName: string; timestamp: string }
  | { kind: 'newUser'; id: string; name: string; timestamp: string }

function useRecentActivity() {
  return useQuery<ActivityItem[]>({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      type LogRow = {
        id: string
        workout_name: string
        logged_at: string
        profiles: { full_name: string | null; email: string } | null
      }

      const [logs, newUsers] = await Promise.all([
        supabase
          .from('workout_logs')
          .select('id, workout_name, logged_at, profiles(full_name, email)')
          .order('logged_at', { ascending: false })
          .limit(10),
        supabase
          .from('profiles')
          .select('id, full_name, email, created_at')
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      const logItems: ActivityItem[] = ((logs.data ?? []) as unknown as LogRow[]).map(l => ({
        kind: 'workout',
        id: `log-${l.id}`,
        userName: l.profiles?.full_name ?? l.profiles?.email ?? 'Unknown',
        workoutName: l.workout_name,
        timestamp: l.logged_at,
      }))

      const userItems: ActivityItem[] = (newUsers.data ?? []).map(u => ({
        kind: 'newUser',
        id: `user-${u.id}`,
        name: u.full_name ?? u.email,
        timestamp: u.created_at,
      }))

      return [...logItems, ...userItems]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10)
    },
  })
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-5">
      <p className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest mb-2">{label}</p>
      <p className="text-3xl font-extrabold text-[var(--text)]">{value}</p>
    </div>
  )
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function Dashboard() {
  const stats = useStats()
  const activeQuote = useActiveQuote()
  const activity = useRecentActivity()
  const navigate = useNavigate()

  return (
    <div className="p-4 sm:p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-[var(--text)]">Dashboard</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total Users"   value={stats.data?.users    ?? 0} />
        <StatCard label="Workout Plans" value={stats.data?.workouts  ?? 0} />
        <StatCard label="Meal Plans"    value={stats.data?.mealPlans ?? 0} />
        <StatCard label="Recipes"       value={stats.data?.recipes   ?? 0} />
      </div>

      {/* Active Quote */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-5 mb-5">
        <p className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest mb-2">Active Quote</p>
        {activeQuote.data ? (
          <>
            <p className="text-sm text-[var(--text-muted)] italic leading-relaxed">"{activeQuote.data.text}"</p>
            <p className="text-xs text-[var(--text-disabled)] mt-1">— {activeQuote.data.author}</p>
          </>
        ) : (
          <p className="text-sm text-[var(--text-disabled)]">No active quote. <button className="underline cursor-pointer bg-transparent border-0 text-[var(--text-muted)] text-sm" onClick={() => navigate('/admin/quotes')}>Set one →</button></p>
        )}
      </div>

      {/* Panels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-5">
          <p className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest mb-3">Recent Activity</p>
          {activity.isLoading && <p className="text-xs text-[var(--text-disabled)]">Loading…</p>}
          {activity.data?.map(item => (
            <div key={item.id} className="flex items-center gap-2 py-2 border-b border-[var(--border-subtle)] last:border-0">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.kind === 'workout' ? 'bg-green-500' : 'bg-[var(--border)]'}`} />
              <span className="text-xs text-[var(--text-muted)] flex-1">
                {item.kind === 'workout'
                  ? `${item.userName} logged ${item.workoutName}`
                  : `New user: ${item.name}`}
              </span>
              <span className="text-[10px] text-[var(--text-disabled)]">{timeAgo(item.timestamp)}</span>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-5">
          <p className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest mb-3">Quick Actions</p>
          <div className="flex flex-col gap-2">
            <Button variant="primary" className="w-full justify-start" onClick={() => navigate('/admin/workouts')}>
              + Create workout plan
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => navigate('/admin/nutrition')}>
              + Add recipe
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => navigate('/admin/nutrition')}>
              + Create meal plan
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => navigate('/admin/quotes')}>
              ✏️ Update active quote
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
