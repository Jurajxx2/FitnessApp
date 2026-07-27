// admin/src/pages/admin/Dashboard.tsx
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { DailyQuote } from '../../types/database'
import { Button, Card, PageHeader } from '../../components/ui'

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
      const error = [users, workouts, mealPlans, recipes].find(result => result.error)?.error
      if (error) throw error
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

      if (logs.error) throw logs.error
      if (newUsers.error) throw newUsers.error

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
    <Card>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-secondary">{label}</p>
      <p className="text-3xl font-display font-extrabold tracking-tight tabular-nums text-text-primary">{value}</p>
    </Card>
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
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader title="Dashboard" description="Your coaching workspace at a glance." />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5" aria-busy={stats.isLoading}>
        <StatCard label="Total Users"   value={stats.data?.users    ?? 0} />
        <StatCard label="Workout Plans" value={stats.data?.workouts  ?? 0} />
        <StatCard label="Meal Plans"    value={stats.data?.mealPlans ?? 0} />
        <StatCard label="Recipes"       value={stats.data?.recipes   ?? 0} />
      </div>

      {/* Active Quote */}
      <Card className="mb-5">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-secondary">Active Quote</p>
        {activeQuote.isError ? (
          <p className="text-sm text-error">Couldn’t load the active quote. Refresh to try again.</p>
        ) : activeQuote.data ? (
          <>
            <p className="text-sm italic leading-relaxed text-text-secondary">"{activeQuote.data.text}"</p>
            <p className="mt-1 text-xs text-text-secondary">— {activeQuote.data.author}</p>
          </>
        ) : (
          <p className="text-sm text-text-secondary">No active quote. <button className="cursor-pointer border-0 bg-transparent text-sm text-text-primary underline" onClick={() => navigate('/admin/quotes')}>Set one →</button></p>
        )}
      </Card>

      {/* Panels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <Card>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-text-secondary">Recent Activity</p>
          {activity.isLoading && <p className="text-xs text-text-secondary">Loading…</p>}
          {activity.isError && <p className="text-xs text-error">Couldn’t load recent activity.</p>}
          {!activity.isLoading && !activity.isError && activity.data?.length === 0 && <p className="text-xs text-text-secondary">No recent activity yet.</p>}
          {activity.data?.map(item => (
            <div key={item.id} className="flex items-center gap-2 border-b border-outline-subtle py-2 last:border-0">
              <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${item.kind === 'workout' ? 'bg-success' : 'bg-outline'}`} />
              <span className="flex-1 text-xs text-text-secondary">
                {item.kind === 'workout'
                  ? `${item.userName} logged ${item.workoutName}`
                  : `New user: ${item.name}`}
              </span>
              <span className="text-[10px] text-text-secondary">{timeAgo(item.timestamp)}</span>
            </div>
          ))}
        </Card>

        {/* Quick Actions */}
        <Card>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-text-secondary">Quick Actions</p>
          <div className="flex flex-col gap-2">
            <Button variant="ghost" className="w-full justify-start" onClick={() => navigate('/admin/users/new')}>
              + Create athlete
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => navigate('/admin/workouts/new')}>
              + Create workout plan
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => navigate('/admin/nutrition/recipes/new')}>
              + Add recipe
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => navigate('/admin/nutrition/meal-plans/new')}>
              + Create meal plan
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => navigate('/admin/quotes/new')}>
              ✏️ Update active quote
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
