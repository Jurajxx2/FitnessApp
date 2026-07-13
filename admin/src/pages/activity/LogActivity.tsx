import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bike, Footprints, PersonStanding, Waves } from 'lucide-react'
import { getGeneralActivities, logGeneralActivity } from '../../activity/api'
import { formatDate, formatDuration } from '../../activity/logic'
import type { ActivityDraft, ActivityType } from '../../activity/types'
import { useAuth } from '../../hooks/useAuth'
import { ActivityPage, ErrorBlock, LoadingBlock, PageIntro } from './shared'

const types: Array<{ value: ActivityType; label: string }> = [
  { value: 'WALKING', label: 'Walking' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'CYCLING', label: 'Cycling' },
  { value: 'YOGA', label: 'Yoga' },
  { value: 'SWIMMING', label: 'Swimming' },
  { value: 'OTHER', label: 'Other' },
]

function localDateTimeNow() {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
  return date.toISOString().slice(0, 16)
}

export default function LogActivity() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const queryClient = useQueryClient()
  const [type, setType] = useState<ActivityType>('WALKING')
  const [duration, setDuration] = useState('30')
  const [distance, setDistance] = useState('')
  const [rpe, setRpe] = useState('')
  const [loggedAt, setLoggedAt] = useState(localDateTimeNow)
  const [notes, setNotes] = useState('')
  const activityQuery = useQuery({ queryKey: ['activity', 'general', userId], queryFn: () => getGeneralActivities(userId), enabled: Boolean(userId) })
  const mutation = useMutation({
    mutationFn: (draft: ActivityDraft) => logGeneralActivity(userId, draft),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['activity', 'general', userId] })
      setDuration('30'); setDistance(''); setRpe(''); setNotes(''); setLoggedAt(localDateTimeNow())
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const minutes = Number(duration)
    const distanceValue = distance ? Number(distance) : null
    const rpeValue = rpe ? Number(rpe) : null
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) return
    if (distanceValue != null && distanceValue <= 0) return
    if (rpeValue != null && (rpeValue < 1 || rpeValue > 10)) return
    mutation.mutate({ activity_type: type, duration_minutes: minutes, distance_km: distanceValue, rpe: rpeValue, logged_at: new Date(loggedAt).toISOString(), notes: notes.trim() || null })
  }

  return (
    <ActivityPage>
      <PageIntro eyebrow="Activity" title="Log another activity" description="Record movement outside your workout plan so your full week is visible." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.75fr)]">
        <form onSubmit={submit} className="space-y-5 rounded-2xl border border-outline bg-surface-elevated p-5 sm:p-6">
          <fieldset><legend className="text-xs font-bold uppercase tracking-wider text-text-secondary">Activity type</legend><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{types.map(item => <button key={item.value} type="button" onClick={() => setType(item.value)} className={`min-h-10 cursor-pointer rounded-xl border px-3 text-sm font-semibold ${type === item.value ? 'border-accent bg-accent/10 text-text-accent' : 'border-outline bg-surface text-text-primary'}`}>{item.label}</button>)}</div></fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Duration (minutes)" value={duration} onChange={setDuration} type="number" min="1" max="1440" required />
            <Field label="Distance (km, optional)" value={distance} onChange={setDistance} type="number" min="0.01" step="0.01" />
            <Field label="Effort / RPE (optional)" value={rpe} onChange={setRpe} type="number" min="1" max="10" />
            <Field label="Date and time" value={loggedAt} onChange={setLoggedAt} type="datetime-local" required />
          </div>
          <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary">Notes (optional)<textarea value={notes} onChange={event => setNotes(event.target.value)} rows={3} className="mt-2 w-full resize-y rounded-xl border border-outline bg-surface p-3 text-sm font-normal normal-case tracking-normal text-text-primary outline-none focus:border-accent" /></label>
          <button type="submit" disabled={mutation.isPending} className="min-h-11 w-full cursor-pointer rounded-xl border-0 bg-action-primary px-5 text-sm font-bold text-on-action-primary disabled:opacity-40">{mutation.isPending ? 'Saving…' : 'Save activity'}</button>
          {mutation.isSuccess && <p role="status" className="text-sm text-success">Activity saved.</p>}
          {mutation.isError && <p role="alert" className="text-sm text-error">{mutation.error.message}</p>}
        </form>
        <section>
          <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-text-primary">Recent activities</h3>
          {activityQuery.isLoading ? <div className="mt-3"><LoadingBlock label="Loading activities…" /></div> : activityQuery.isError ? <div className="mt-3"><ErrorBlock message="Activities could not be loaded." /></div> : (activityQuery.data ?? []).length ? <div className="mt-3 space-y-3">{(activityQuery.data ?? []).slice(0, 8).map(activity => <div key={activity.id} className="flex items-center gap-3 rounded-2xl border border-outline bg-surface-elevated p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-highest text-text-primary">{activity.activity_type === 'CYCLING' ? <Bike size={18} /> : activity.activity_type === 'SWIMMING' ? <Waves size={18} /> : activity.activity_type === 'YOGA' ? <PersonStanding size={18} /> : <Footprints size={18} />}</span><div className="min-w-0 flex-1"><p className="text-sm font-bold text-text-primary">{types.find(item => item.value === activity.activity_type)?.label}</p><p className="mt-1 text-xs text-text-secondary">{formatDate(activity.logged_at)} · {formatDuration(activity.duration_minutes)}{activity.distance_km ? ` · ${activity.distance_km} km` : ''}</p></div></div>)}</div> : <p className="mt-3 rounded-2xl border border-dashed border-outline p-6 text-sm text-text-secondary">No general activities logged yet.</p>}
        </section>
      </div>
    </ActivityPage>
  )
}

function Field({ label, value, onChange, ...props }: { label: string; value: string; onChange: (value: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">{label}<input {...props} value={value} onChange={event => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-outline bg-surface px-3 text-sm font-normal normal-case tracking-normal text-text-primary outline-none focus:border-accent" /></label>
}
