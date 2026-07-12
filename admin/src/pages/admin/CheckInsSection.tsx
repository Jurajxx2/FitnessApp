// admin/src/pages/admin/CheckInsSection.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { signedCheckInPhotoUrl } from '../../lib/storage'
import { Button, useNotice } from '../../components/ui'
import type { CheckIn } from '../../types/database'

function useCheckIns(userId: string) {
  return useQuery<CheckIn[]>({
    queryKey: ['user-checkins', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('check_ins')
        .select('*')
        .eq('user_id', userId)
        .order('week_of', { ascending: false })
        .limit(12)
      if (error) throw error
      return (data ?? []) as CheckIn[]
    },
  })
}

function Metric({ label, value }: { label: string; value: number | string | null }) {
  if (value === null || value === '') return null
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-[var(--text-disabled)]">{label}</span>
      <span className="text-sm text-[var(--text)]">{value}</span>
    </div>
  )
}

function PhotoThumb({ path }: { path: string }) {
  const { data: url } = useQuery({
    queryKey: ['checkin-photo', path],
    queryFn: () => signedCheckInPhotoUrl(path),
  })
  if (!url) return null
  return <img src={url} alt="" className="w-24 h-32 rounded-md object-cover" />
}

export function CheckInsSection({ userId, adminUserId }: { userId: string; adminUserId: string | undefined }) {
  const qc = useQueryClient()
  const { notify } = useNotice()
  const { data: checkIns = [], isLoading, error } = useCheckIns(userId)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [editingResponseId, setEditingResponseId] = useState<string | null>(null)

  const respond = useMutation({
    mutationFn: async ({ id, response }: { id: string; response: string }) => {
      if (!adminUserId) throw new Error('Admin session is missing')
      // `.select()` makes PostgREST return the row(s) the UPDATE actually matched.
      // Without it, an UPDATE that matches zero rows (e.g. because the coach-UPDATE
      // RLS policy on check_ins doesn't grant this coach permission on this row)
      // returns NO error from Supabase — a silent no-op that looks identical to a
      // real success. We must check the returned data length ourselves to detect
      // that case. This assumes an RLS policy exists granting coaches UPDATE on
      // clients' check_ins; if that policy is missing/misconfigured, every response
      // will now correctly surface as an error instead of silently failing.
      const { data, error } = await supabase
        .from('check_ins')
        .update({ coach_response: response, coach_response_at: new Date().toISOString(), coach_id: adminUserId })
        .eq('id', id)
        .select()
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Check-in update affected no rows — you may not have permission to respond to this check-in.')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-checkins', userId] })
      setEditingResponseId(null)
      notify('Check-in response saved.')
    },
    onError: error => notify(`Couldn’t save check-in response: ${error.message}`, 'error'),
  })

  return (
    <div>
      <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Weekly Check-ins</p>
      {isLoading && <p className="text-sm text-[var(--text-disabled)]">Loading…</p>}
      {error && <p className="text-sm text-red-400">{(error as Error).message}</p>}
      {!isLoading && checkIns.length === 0 && (
        <p className="text-sm text-[var(--text-disabled)]">No check-ins yet.</p>
      )}
      <div className="flex flex-col gap-3">
        {checkIns.map((c) => (
          <div key={c.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3">
            <p className="text-xs text-[var(--text-disabled)]">Week of {c.week_of}</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Metric label="Weight" value={c.weight_kg !== null ? `${c.weight_kg} kg` : null} />
              <Metric label="Energy" value={c.energy_level} />
              <Metric label="Sleep" value={c.sleep_quality} />
              <Metric label="Stress" value={c.stress_level} />
              <Metric label="Training" value={c.training_adherence} />
              <Metric label="Nutrition" value={c.nutrition_adherence} />
            </div>
            {c.notes && <p className="mt-2 text-sm text-[var(--text-muted)] whitespace-pre-wrap">{c.notes}</p>}
            {(c.photo_front_path || c.photo_side_path) && (
              <div className="mt-2 flex gap-2">
                {c.photo_front_path && <PhotoThumb path={c.photo_front_path} />}
                {c.photo_side_path && <PhotoThumb path={c.photo_side_path} />}
              </div>
            )}
            {c.coach_response && editingResponseId !== c.id ? (
              <div className="mt-3 p-2 bg-[var(--input-bg)] rounded border border-[var(--border)]">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold text-[var(--text-disabled)] uppercase">Coach Response</p>
                  <button
                    type="button"
                    className="cursor-pointer border-0 bg-transparent p-0 text-xs font-medium text-text-secondary hover:text-text-primary"
                    onClick={() => {
                      setEditingResponseId(c.id)
                      setDrafts(current => ({ ...current, [c.id]: c.coach_response ?? '' }))
                    }}
                  >
                    Edit
                  </button>
                </div>
                <p className="text-xs text-[var(--text)] whitespace-pre-wrap">{c.coach_response}</p>
              </div>
            ) : (
              <div className="mt-3">
                <textarea
                  className="w-full min-h-16 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--text)] outline-none"
                  placeholder="Write coach response…"
                  value={drafts[c.id] ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                />
                <Button
                  variant="ghost"
                  className="mt-2 w-full py-1.5 text-xs"
                  onClick={() => respond.mutate({ id: c.id, response: drafts[c.id] })}
                  loading={respond.isPending}
                  disabled={!drafts[c.id]?.trim()}
                >
                  {c.coach_response ? 'Save response' : 'Respond'}
                </Button>
                {c.coach_response && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingResponseId(null)
                      setDrafts(current => ({ ...current, [c.id]: c.coach_response ?? '' }))
                    }}
                    className="mt-2 w-full cursor-pointer border-0 bg-transparent text-xs text-text-secondary hover:text-text-primary"
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
