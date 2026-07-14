import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, EmptyState, Input, PageHeader, useNotice } from '../components/ui'
import { NutritionPreferencesForm } from '../components/NutritionPreferencesForm'
import { useAuth } from '../hooks/useAuth'
import { defaultPreferences, useNutritionPreferences, useSaveNutritionPreferences } from '../nutrition/preferences'
import { supabase } from '../lib/supabase'
import type { ActivityLevel, Goal, Profile as ProfileRecord, UserNutritionPreferences } from '../types/database'

interface ProfileDraft {
  fullName: string
  age: string
  heightCm: string
  weightKg: string
  goal: Goal | ''
  activityLevel: ActivityLevel | ''
}

function toDraft(profile: ProfileRecord): ProfileDraft {
  return {
    fullName: profile.full_name ?? '',
    age: profile.age == null ? '' : String(profile.age),
    heightCm: profile.height_cm == null ? '' : String(profile.height_cm),
    weightKg: profile.weight_kg == null ? '' : String(profile.weight_kg),
    goal: profile.goal ?? '',
    activityLevel: profile.activity_level ?? '',
  }
}

function optionalNumber(value: string): number | null {
  return value.trim() ? Number(value) : null
}

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth()
  const { notify } = useNotice()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<ProfileDraft | null>(() => profile ? toDraft(profile) : null)

  useEffect(() => {
    if (profile) setDraft(toDraft(profile))
  }, [profile])

  const validationError = useMemo(() => {
    if (!draft) return 'Profile is unavailable.'
    const age = optionalNumber(draft.age)
    const height = optionalNumber(draft.heightCm)
    const weight = optionalNumber(draft.weightKg)
    if (age != null && (!Number.isInteger(age) || age < 13 || age > 120)) return 'Age must be a whole number from 13 to 120.'
    if (height != null && (!Number.isFinite(height) || height < 50 || height > 260)) return 'Height must be between 50 and 260 cm.'
    if (weight != null && (!Number.isFinite(weight) || weight < 20 || weight > 500)) return 'Weight must be between 20 and 500 kg.'
    return null
  }, [draft])

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!user || !draft) throw new Error('Profile is unavailable')
      if (validationError) throw new Error(validationError)

      const { data, error } = await supabase
        .from('profiles')
        .update({
          full_name: draft.fullName.trim() || null,
          age: optionalNumber(draft.age),
          height_cm: optionalNumber(draft.heightCm),
          weight_kg: optionalNumber(draft.weightKg),
          goal: draft.goal || null,
          activity_level: draft.activityLevel || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select('id')
        .maybeSingle()

      if (error) throw error
      if (!data) throw new Error('No profile was updated')
      await refreshProfile()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['user', user?.id] })
      notify('Profile updated.')
    },
    onError: error => notify(`Couldn’t update profile: ${error.message}`, 'error'),
  })

  const preferencesQuery = useNutritionPreferences(user?.id ?? '')
  const savePreferences = useSaveNutritionPreferences(user?.id ?? '')
  const [preferences, setPreferences] = useState<UserNutritionPreferences>(() => defaultPreferences(user?.id ?? ''))
  useEffect(() => { if (preferencesQuery.data) setPreferences(preferencesQuery.data) }, [preferencesQuery.data])

  if (!profile || !draft) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <EmptyState title="Profile couldn’t be loaded" description="Refresh the page to retry." />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Profile"
        description="Keep the personal details used for coaching, targets, and progress up to date."
        actions={<Button onClick={() => saveProfile.mutate()} loading={saveProfile.isPending} disabled={Boolean(validationError)}>Save profile</Button>}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card>
          <h2 className="text-base font-bold text-text-primary">Personal details</h2>
          <p className="mt-1 text-sm text-text-secondary">These values help tailor nutrition and activity recommendations.</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Input label="Full name" value={draft.fullName} onChange={event => setDraft(current => current && ({ ...current, fullName: event.target.value }))} />
            <Input label="Email" value={user?.email ?? profile.email} disabled />
            <Input label="Age" type="number" min="13" max="120" value={draft.age} onChange={event => setDraft(current => current && ({ ...current, age: event.target.value }))} />
            <Input label="Height (cm)" type="number" min="50" max="260" step="0.1" value={draft.heightCm} onChange={event => setDraft(current => current && ({ ...current, heightCm: event.target.value }))} />
            <Input label="Weight (kg)" type="number" min="20" max="500" step="0.1" value={draft.weightKg} onChange={event => setDraft(current => current && ({ ...current, weightKg: event.target.value }))} />
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Goal</label>
              <select className="h-10 w-full rounded-xl border border-outline bg-surface px-3 text-sm text-text-primary outline-none focus:border-accent" value={draft.goal} onChange={event => setDraft(current => current && ({ ...current, goal: event.target.value as Goal | '' }))}>
                <option value="">Not set</option>
                <option value="lose_weight">Lose weight</option>
                <option value="build_muscle">Build muscle</option>
                <option value="get_stronger">Get stronger</option>
                <option value="stay_fit">Stay fit</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Activity level</label>
              <select className="h-10 w-full rounded-xl border border-outline bg-surface px-3 text-sm text-text-primary outline-none focus:border-accent" value={draft.activityLevel} onChange={event => setDraft(current => current && ({ ...current, activityLevel: event.target.value as ActivityLevel | '' }))}>
                <option value="">Not set</option>
                <option value="sedentary">Sedentary</option>
                <option value="lightly_active">Lightly active</option>
                <option value="moderately_active">Moderately active</option>
                <option value="active">Active</option>
                <option value="very_active">Very active</option>
              </select>
            </div>
          </div>

          {validationError && <p role="alert" className="mt-4 text-sm text-error">{validationError}</p>}
          {saveProfile.error && <p role="alert" className="mt-4 text-sm text-error">{saveProfile.error.message}</p>}
        </Card>

        <Card>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-accent">Account</p>
          <h2 className="mt-2 text-lg font-bold text-text-primary">{profile.full_name || 'Your profile'}</h2>
          <p className="mt-1 break-all text-xs text-text-secondary">{user?.email ?? profile.email}</p>
          <div className="mt-5 divide-y divide-outline-subtle text-sm">
            <div className="flex justify-between gap-3 py-2"><span className="text-text-secondary">Role</span><span className="font-semibold text-text-primary">{profile.is_admin ? 'Admin + user' : 'User'}</span></div>
            <div className="flex justify-between gap-3 py-2"><span className="text-text-secondary">Coaching access</span><span className="font-semibold capitalize text-text-primary">{profile.access_mode === 'both' ? 'Nutrition + activity' : profile.access_mode}</span></div>
          </div>
          <p className="mt-4 text-xs leading-5 text-text-secondary">Role and coaching access are managed separately and cannot be changed from this page.</p>
        </Card>
      </div>

      <Card className="mt-6 p-5 sm:p-6">
        <h2 className="text-base font-bold text-text-primary">Stravovacie preferencie</h2>
        <p className="mt-1 text-sm text-text-secondary">Tieto nastavenia používa tréner pri tvorbe tvojho jedálnička.</p>
        <div className="mt-4">
          <NutritionPreferencesForm value={preferences} onChange={setPreferences} locale="sk" />
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={() => savePreferences.mutate(preferences, {
              onSuccess: () => notify('Preferencie boli uložené.'),
              onError: () => notify('Preferencie sa nepodarilo uložiť.', 'error'),
            })}
            loading={savePreferences.isPending}
          >
            Uložiť preferencie
          </Button>
        </div>
      </Card>
    </div>
  )
}
