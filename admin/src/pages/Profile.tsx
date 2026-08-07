import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LogOut, Moon, Sun } from 'lucide-react'
import { Button, Card, EmptyState, Input, PageHeader, useNotice } from '../components/ui'
import { NutritionPreferencesForm } from '../components/NutritionPreferencesForm'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
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
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { notify } = useNotice()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<ProfileDraft | null>(() => profile ? toDraft(profile) : null)

  useEffect(() => {
    if (profile) setDraft(toDraft(profile))
  }, [profile])

  const validationError = useMemo(() => {
    if (!draft) return 'Profil nie je dostupný.'
    const age = optionalNumber(draft.age)
    const height = optionalNumber(draft.heightCm)
    const weight = optionalNumber(draft.weightKg)
    if (age != null && (!Number.isInteger(age) || age < 13 || age > 120)) return 'Vek musí byť celé číslo od 13 do 120.'
    if (height != null && (!Number.isFinite(height) || height < 50 || height > 260)) return 'Výška musí byť v rozmedzí 50 až 260 cm.'
    if (weight != null && (!Number.isFinite(weight) || weight < 20 || weight > 500)) return 'Váha musí byť v rozmedzí 20 až 500 kg.'
    return null
  }, [draft])

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!user || !draft) throw new Error('Profil nie je dostupný')
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
      if (!data) throw new Error('Profil sa nepodarilo aktualizovať')
      await refreshProfile()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['user', user?.id] })
      notify('Profil bol aktualizovaný.')
    },
    onError: error => notify(`Profil sa nepodarilo aktualizovať: ${error.message}`, 'error'),
  })

  const preferencesQuery = useNutritionPreferences(user?.id ?? '')
  const savePreferences = useSaveNutritionPreferences(user?.id ?? '')
  const [preferences, setPreferences] = useState<UserNutritionPreferences>(() => defaultPreferences(user?.id ?? ''))
  useEffect(() => { if (preferencesQuery.data) setPreferences(preferencesQuery.data) }, [preferencesQuery.data])

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  const ThemeIcon = theme === 'dark' ? Moon : Sun

  if (!profile || !draft) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <EmptyState title="Profil sa nepodarilo načítať" description="Obnov stránku a skús to znova." />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Profil"
        description="Udržuj svoje údaje pre koučing a ciele aktuálne."
        actions={<Button onClick={() => saveProfile.mutate()} loading={saveProfile.isPending} disabled={Boolean(validationError)}>Uložiť zmeny</Button>}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card>
          <h2 className="text-base font-bold text-text-primary">Osobné údaje</h2>
          <p className="mt-1 text-sm text-text-secondary">Tieto údaje pomáhajú prispôsobiť odporúčania pre výživu a aktivitu.</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Input label="Celé meno" value={draft.fullName} onChange={event => setDraft(current => current && ({ ...current, fullName: event.target.value }))} />
            <Input label="E-mail" value={user?.email ?? profile.email} disabled />
            <Input label="Vek" type="number" min="13" max="120" value={draft.age} onChange={event => setDraft(current => current && ({ ...current, age: event.target.value }))} />
            <Input label="Výška (cm)" type="number" min="50" max="260" step="0.1" value={draft.heightCm} onChange={event => setDraft(current => current && ({ ...current, heightCm: event.target.value }))} />
            <Input label="Váha (kg)" type="number" min="20" max="500" step="0.1" value={draft.weightKg} onChange={event => setDraft(current => current && ({ ...current, weightKg: event.target.value }))} />
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Cieľ</label>
              <select className="h-10 w-full rounded-xl border border-outline bg-surface px-3 text-sm text-text-primary outline-none focus:border-accent" value={draft.goal} onChange={event => setDraft(current => current && ({ ...current, goal: event.target.value as Goal | '' }))}>
                <option value="">Nenastavené</option>
                <option value="lose_weight">Schudnúť</option>
                <option value="build_muscle">Nabrať svaly</option>
                <option value="get_stronger">Zosilnieť</option>
                <option value="stay_fit">Udržať sa fit</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Úroveň aktivity</label>
              <select className="h-10 w-full rounded-xl border border-outline bg-surface px-3 text-sm text-text-primary outline-none focus:border-accent" value={draft.activityLevel} onChange={event => setDraft(current => current && ({ ...current, activityLevel: event.target.value as ActivityLevel | '' }))}>
                <option value="">Nenastavené</option>
                <option value="sedentary">Sedavý</option>
                <option value="lightly_active">Mierne aktívny</option>
                <option value="moderately_active">Stredne aktívny</option>
                <option value="active">Aktívny</option>
                <option value="very_active">Veľmi aktívny</option>
              </select>
            </div>
          </div>

          {validationError && <p role="alert" className="mt-4 text-sm text-error">{validationError}</p>}
          {saveProfile.error && <p role="alert" className="mt-4 text-sm text-error">{saveProfile.error.message}</p>}
        </Card>

        <Card>
          <p className="flex items-center gap-2 ledger-label text-text-secondary">
            <span className="h-3.5 w-[3px] shrink-0 rounded-full bg-accent-strong" aria-hidden="true" />
            Účet
          </p>
          <h2 className="mt-2 text-lg font-bold text-text-primary">{profile.full_name || 'Tvoj profil'}</h2>
          <p className="mt-1 break-all text-xs text-text-secondary">{user?.email ?? profile.email}</p>
          <div className="mt-5 divide-y divide-outline-subtle text-sm">
            <div className="flex justify-between gap-3 py-2"><span className="text-text-secondary">Rola</span><span className="font-semibold text-text-primary">{profile.is_admin ? 'Administrátor + používateľ' : 'Používateľ'}</span></div>
            <div className="flex justify-between gap-3 py-2"><span className="text-text-secondary">Prístup ku koučingu</span><span className="font-semibold capitalize text-text-primary">{profile.access_mode === 'both' ? 'Výživa + tréning' : profile.access_mode === 'nutrition' ? 'Výživa' : profile.access_mode === 'activity' ? 'Tréning' : '—'}</span></div>
          </div>
          <p className="mt-4 text-xs leading-5 text-text-secondary">Rolu a prístup ku koučingu spravuje trénerka a na tejto stránke ich nemožno zmeniť.</p>

          <div className="flex flex-col gap-2 border-t border-outline-subtle pt-4 mt-4 sm:flex-row">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-outline bg-surface text-sm font-semibold text-text-primary transition-colors hover:bg-surface-elevated"
            >
              <ThemeIcon size={18} aria-hidden="true" /> {theme === 'dark' ? 'Tmavý vzhľad' : 'Svetlý vzhľad'}
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-error/40 bg-error/10 text-sm font-semibold text-error transition-colors hover:bg-error/20"
            >
              <LogOut size={18} aria-hidden="true" /> Odhlásiť sa
            </button>
          </div>
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
            disabled={preferencesQuery.isLoading}
          >
            Uložiť preferencie
          </Button>
        </div>
      </Card>
    </div>
  )
}
