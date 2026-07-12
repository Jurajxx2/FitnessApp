import { useEffect, useRef, useState } from 'react'
import { Check, History, ImagePlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Chip, Input, SectionHeader, Shimmer } from '../../components/ui'
import { checkInToDraft, emptyCheckInDraft, type CheckInDraft } from '../../checkins/api'
import { useCurrentCheckIn, useSaveCheckIn, useUploadCheckInPhoto } from '../../checkins/hooks'
import { useAuth } from '../../hooks/useAuth'

function RatingRow({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-text-primary">{label}</span>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(rating => (
          <Chip key={rating} selected={value === rating} onClick={() => onChange(rating)}>{rating}</Chip>
        ))}
      </div>
    </div>
  )
}

function PhotoSlot({
  label, selected, disabled, onPick,
}: { label: string; selected: boolean; disabled: boolean; onPick: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className={`h-30 flex-1 rounded-xl border flex flex-col items-center justify-center gap-2 text-xs disabled:opacity-40 ${
          selected ? 'bg-action-secondary border-text-secondary text-text-primary' : 'bg-surface border-outline text-text-secondary'
        }`}
      >
        {selected ? <Check size={26} /> : <ImagePlus size={26} />}
        {selected ? `Fotka ${label} pridaná` : `Vybrať fotku ${label}`}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={event => {
          const file = event.target.files?.[0]
          if (file) onPick(file)
          event.target.value = ''
        }}
      />
    </>
  )
}

export default function CheckInForm() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const current = useCurrentCheckIn()
  const upload = useUploadCheckInPhoto()
  const save = useSaveCheckIn()
  const [draft, setDraft] = useState<CheckInDraft>(() => emptyCheckInDraft())
  const [initialized, setInitialized] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!current.isFetched || initialized) return
    setDraft(current.data ? checkInToDraft(current.data) : emptyCheckInDraft(profile?.weight_kg?.toString() ?? ''))
    setInitialized(true)
  }, [current.data, current.isFetched, initialized, profile?.weight_kg])

  function update<K extends keyof CheckInDraft>(key: K, value: CheckInDraft[K]) {
    setDraft(previous => ({ ...previous, [key]: value }))
  }

  async function pickPhoto(slot: 'front' | 'side', file: File) {
    try {
      const path = await upload.mutateAsync({ slot, file })
      update(slot === 'front' ? 'photoFrontPath' : 'photoSidePath', path)
    } catch {
      // The mutation error is rendered below and the existing photo remains intact.
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    try {
      await save.mutateAsync({ draft, previousWeight: current.data?.weight_kg ?? null })
      setSubmitted(true)
    } catch {
      // The mutation error is rendered below.
    }
  }

  if (current.isLoading || !initialized) return <Shimmer className="h-64 w-full" />

  if (submitted) {
    return (
      <div className="min-h-[65dvh] flex flex-col items-center justify-center text-center gap-4 px-6">
        <div className="w-18 h-18 rounded-full bg-action-secondary flex items-center justify-center"><Check size={36} /></div>
        <h1 className="text-xl font-bold">Check-in odoslaný</h1>
        <p className="text-sm text-text-secondary">Trénerka si ho čoskoro pozrie. Skvelá práca, že si konzistentný!</p>
        <Button onClick={() => navigate('/check-ins/history')}>Pozrieť históriu</Button>
      </div>
    )
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={submit}>
      <SectionHeader
        title="Týždenný check-in"
        action={<button type="button" aria-label="História check-inov" onClick={() => navigate('/check-ins/history')}><History size={22} /></button>}
      />

      <Card className="flex flex-col gap-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Telo</h2>
        <Input id="checkin-weight" label="Hmotnosť (kg)" inputMode="decimal" value={draft.weightKg} onChange={e => update('weightKg', e.target.value)} />
        <Input id="checkin-training" label="Absolvované tréningy" inputMode="numeric" value={draft.trainingAdherence} onChange={e => update('trainingAdherence', e.target.value)} />
      </Card>

      <Card className="flex flex-col gap-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Ako sa cítiš?</h2>
        <RatingRow label="Energia" value={draft.energyLevel} onChange={value => update('energyLevel', value)} />
        <RatingRow label="Kvalita spánku" value={draft.sleepQuality} onChange={value => update('sleepQuality', value)} />
        <RatingRow label="Stres" value={draft.stressLevel} onChange={value => update('stressLevel', value)} />
        <RatingRow label="Dodržiavanie stravy" value={draft.nutritionAdherence} onChange={value => update('nutritionAdherence', value)} />
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Fotky pokroku</h2>
        <div className="flex gap-3">
          <PhotoSlot label="spredu" selected={!!draft.photoFrontPath} disabled={upload.isPending || save.isPending} onPick={file => void pickPhoto('front', file)} />
          <PhotoSlot label="zboku" selected={!!draft.photoSidePath} disabled={upload.isPending || save.isPending} onPick={file => void pickPhoto('side', file)} />
        </div>
        {upload.isPending && <p className="text-xs text-text-secondary">Nahrávam fotku…</p>}
      </Card>

      <Card className="flex flex-col gap-3">
        <label htmlFor="checkin-notes" className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Poznámky</label>
        <textarea
          id="checkin-notes"
          rows={5}
          value={draft.notes}
          onChange={e => update('notes', e.target.value)}
          placeholder="Ako prebiehal tvoj týždeň?"
          className="p-3 rounded-xl bg-surface border border-outline text-text-primary outline-none focus:border-text-secondary placeholder:text-text-secondary resize-y"
        />
      </Card>

      {(current.error || upload.error || save.error) && (
        <p role="alert" className="text-sm text-error">Check-in sa nepodarilo uložiť. Skús to znova.</p>
      )}
      <Button type="submit" loading={save.isPending} disabled={upload.isPending}>Odoslať check-in</Button>
    </form>
  )
}
