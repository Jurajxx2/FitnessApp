import { ArrowLeft, Camera, History } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, EmptyState, Shimmer } from '../../components/ui'
import { useCheckIns } from '../../checkins/hooks'
import { formatCheckInWeek, formatResponseDate } from '../../checkins/date'

function Metric({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="text-text-primary">{value ?? '—'}</span>
    </div>
  )
}

export default function CheckInHistory() {
  const navigate = useNavigate()
  const { data: checkIns = [], isLoading, error } = useCheckIns()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Späť na check-in" onClick={() => navigate('/check-ins')}><ArrowLeft size={22} /></button>
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Týždenný pokrok</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-0.035em]">História check-inov</h1></div>
      </div>

      {isLoading && <Shimmer className="h-48 w-full" />}
      {error && <p role="alert" className="text-sm text-error">Históriu sa nepodarilo načítať.</p>}
      {!isLoading && !error && checkIns.length === 0 && (
        <EmptyState icon={<History size={30} />} title="Zatiaľ žiadne check-iny" message="Odošli svoj prvý týždenný check-in a začni budovať históriu." />
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
      {checkIns.map(checkIn => (
        <Card key={checkIn.id} className="flex flex-col gap-4">
          <h2 className="font-bold">Týždeň od {formatCheckInWeek(checkIn.week_of)}</h2>
          <div className="flex flex-col gap-2">
            <Metric label="Hmotnosť" value={checkIn.weight_kg === null ? null : `${checkIn.weight_kg} kg`} />
            <Metric label="Energia" value={checkIn.energy_level === null ? null : `${checkIn.energy_level} / 5`} />
            <Metric label="Spánok" value={checkIn.sleep_quality === null ? null : `${checkIn.sleep_quality} / 5`} />
            <Metric label="Stres" value={checkIn.stress_level === null ? null : `${checkIn.stress_level} / 5`} />
            <Metric label="Tréning" value={checkIn.training_adherence === null ? null : `${checkIn.training_adherence} tréningov`} />
            <Metric label="Strava" value={checkIn.nutrition_adherence === null ? null : `${checkIn.nutrition_adherence} / 5`} />
          </div>
          {checkIn.notes && <p className="text-sm text-text-secondary whitespace-pre-wrap">{checkIn.notes}</p>}
          {(checkIn.photo_front_path || checkIn.photo_side_path) && (
            <div className="flex items-center gap-2 text-xs text-text-secondary"><Camera size={16} /> Fotky priložené</div>
          )}
          {checkIn.coach_response && (
            <div className="rounded-xl bg-surface p-3 border border-outline-subtle flex flex-col gap-1">
              <span className="text-xs font-semibold text-text-accent">Odpoveď trénerky</span>
              <p className="text-sm whitespace-pre-wrap">{checkIn.coach_response}</p>
              {checkIn.coach_response_at && <span className="text-xs text-text-secondary">{formatResponseDate(checkIn.coach_response_at)}</span>}
            </div>
          )}
        </Card>
      ))}
      </div>
    </div>
  )
}
