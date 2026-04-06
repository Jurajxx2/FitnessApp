// admin/src/pages/admin/UserDetail.tsx
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { SlideOver, Button, Input, Badge } from '../../components/ui'
import type { Profile, Workout, MealPlan, WeightEntry } from '../../types/database'

function useUser(id: string) {
  return useQuery<Profile>({
    queryKey: ['user', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
  })
}

function useWorkoutPlans() {
  return useQuery<Pick<Workout, 'id' | 'name'>[]>({
    queryKey: ['workout-plans'],
    queryFn: async () => {
      const { data } = await supabase.from('workouts').select('id, name').order('name')
      return (data ?? []) as Pick<Workout, 'id' | 'name'>[]
    },
  })
}

function useMealPlans() {
  return useQuery<Pick<MealPlan, 'id' | 'name'>[]>({
    queryKey: ['meal-plans'],
    queryFn: async () => {
      const { data } = await supabase.from('meal_plans').select('id, name').order('name')
      return (data ?? []) as Pick<MealPlan, 'id' | 'name'>[]
    },
  })
}

function useWeightHistory(userId: string) {
  return useQuery<WeightEntry[]>({
    queryKey: ['weight-history', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('weight_entries')
        .select('*')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: false })
        .limit(10)
      return data ?? []
    },
  })
}

const GOAL_LABELS: Record<string, string> = {
  weight_loss: 'Weight loss', muscle_gain: 'Muscle gain', mental_strength: 'Mental strength',
}
const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentary', lightly_active: 'Lightly active',
  moderately_active: 'Moderately active', active: 'Active', very_active: 'Very active',
}

function deriveStatus(p: Profile): 'active' | 'inactive' | 'blocked' {
  if (p.is_blocked) return 'blocked'
  if (!p.onboarding_complete) return 'inactive'
  return 'active'
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: user, isLoading } = useUser(id!)
  const { data: workoutPlans = [] } = useWorkoutPlans()
  const { data: mealPlans = [] } = useMealPlans()
  const { data: weightHistory = [] } = useWeightHistory(id!)

  const [adminNotes, setAdminNotes] = useState('')

  useEffect(() => {
    if (user?.admin_notes) {
      setAdminNotes(user.admin_notes)
    }
  }, [user?.admin_notes])

  const updateProfile = useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', id!)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user', id] }),
  })

  const assignWorkout = useMutation({
    mutationFn: async (workoutId: string) => {
      const { error } = await supabase.from('workouts').update({ user_id: id }).eq('id', workoutId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      qc.invalidateQueries({ queryKey: ['user', id] })
    },
  })

  const assignMealPlan = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase.from('meal_plans').update({ user_id: id }).eq('id', planId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      qc.invalidateQueries({ queryKey: ['user', id] })
    },
  })

  function Field({ label, value }: { label: string; value: string | number | null }) {
    return (
      <div>
        <p className="text-[10px] text-[var(--text-disabled)] uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-sm text-[var(--text)]">{value ?? '—'}</p>
      </div>
    )
  }

  if (isLoading || !user) {
    return (
      <SlideOver open title="User Detail" onClose={() => navigate('/admin/users')}>
        <p className="text-sm text-[var(--text-disabled)]">Loading…</p>
      </SlideOver>
    )
  }

  return (
    <SlideOver open title={user.full_name ?? user.email} onClose={() => navigate('/admin/users')}>
      <div className="flex flex-col gap-6">
        {/* Status */}
        <div className="flex items-center gap-2">
          <Badge status={deriveStatus(user)} />
        </div>

        {/* Profile info */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Full name"  value={user.full_name} />
          <Field label="Email"      value={user.email} />
          <Field label="Age"        value={user.age} />
          <Field label="Height"     value={user.height_cm ? `${user.height_cm} cm` : null} />
          <Field label="Weight"     value={user.weight_kg ? `${user.weight_kg} kg` : null} />
          <Field label="Goal"       value={user.goal ? GOAL_LABELS[user.goal] : null} />
          <Field label="Activity"   value={user.activity_level ? ACTIVITY_LABELS[user.activity_level] : null} />
          <Field label="Joined"     value={new Date(user.created_at).toLocaleDateString()} />
          <Field label="Onboarding" value={user.onboarding_complete ? 'Complete' : 'Incomplete'} />
        </div>

        {/* Assign workout plan */}
        <div>
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Assign Workout Plan</p>
          <select
            className="w-full bg-[var(--input-bg)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] outline-none"
            defaultValue=""
            onChange={e => { if (e.target.value) assignWorkout.mutate(e.target.value) }}
          >
            <option value="" disabled>Select a plan…</option>
            {workoutPlans.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        {/* Assign meal plan */}
        <div>
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Assign Meal Plan</p>
          <select
            className="w-full bg-[var(--input-bg)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] outline-none"
            defaultValue=""
            onChange={e => { if (e.target.value) assignMealPlan.mutate(e.target.value) }}
          >
            <option value="" disabled>Select a plan…</option>
            {mealPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Weight history */}
        {weightHistory.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Weight History</p>
            <div className="flex flex-col gap-1">
              {weightHistory.map(e => (
                <div key={e.id} className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">{e.recorded_at}</span>
                  <span className="text-[var(--text)] font-semibold">{e.weight_kg} kg</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin notes */}
        <div>
          <Input
            label="Admin Notes"
            value={adminNotes || user.admin_notes || ''}
            onChange={e => setAdminNotes(e.target.value)}
            placeholder="Private notes about this user…"
          />
          <Button
            variant="ghost"
            className="mt-2 w-full"
            onClick={() => updateProfile.mutate({ admin_notes: adminNotes })}
            loading={updateProfile.isPending}
          >
            Save notes
          </Button>
        </div>

        {/* Block / Unblock */}
        <Button
          variant={user.is_blocked ? 'ghost' : 'danger'}
          className="w-full"
          onClick={() => updateProfile.mutate({ is_blocked: !user.is_blocked })}
          loading={updateProfile.isPending}
        >
          {user.is_blocked ? 'Unblock user' : 'Block user'}
        </Button>
      </div>
    </SlideOver>
  )
}
