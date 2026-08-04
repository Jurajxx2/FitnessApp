import { useState } from 'react'
import { ArrowLeft, History } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, EmptyState, Pagination, Shimmer } from '../../components/ui'
import { CheckInPhoto } from '../../components/CheckInPhoto'
import { useCheckIns } from '../../checkins/hooks'
import { formatCheckInWeek, formatResponseDate } from '../../checkins/date'
import type { CheckInRow } from '../../types/database'

function Metric({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="text-text-primary">{value ?? '—'}</span>
    </div>
  )
}

/** One decimal place, Slovak comma separator, e.g. `82,4 kg`. */
function formatWeightKg(value: number): string {
  return `${value.toFixed(1).replace('.', ',')} kg`
}

/** Real minus sign for losses, `+` for gains, e.g. `−2,3 kg` / `+1,0 kg`. */
function formatWeightDelta(delta: number): string {
  const sign = delta < 0 ? '−' : '+'
  return `${sign}${Math.abs(delta).toFixed(1).replace('.', ',')} kg`
}

/**
 * Weight trend for the check-ins on the current page: a small inline sparkline
 * plus a first → last summary line. Renders nothing with fewer than two
 * weighed check-ins — there is no trend to show for zero or one data point.
 */
function WeightTrend({ checkIns }: { checkIns: CheckInRow[] }) {
  const weighed = [...checkIns]
    .filter(c => c.weight_kg !== null)
    .sort((a, b) => a.week_of.localeCompare(b.week_of))

  if (weighed.length < 2) return null

  const weights = weighed.map(c => c.weight_kg as number)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const points = weights
    .map((weight, index) => {
      const x = (index / (weights.length - 1)) * 100
      const y = max === min ? 16 : 32 - ((weight - min) / (max - min)) * 32
      return `${x},${y}`
    })
    .join(' ')

  const first = weights[0]
  const last = weights[weights.length - 1]

  return (
    <Card className="flex flex-col gap-3">
      <p className="ledger-label text-text-secondary">Vývoj hmotnosti</p>
      <div className="flex items-center gap-4">
        <svg
          viewBox="0 0 100 32"
          preserveAspectRatio="none"
          role="img"
          aria-label="Vývoj hmotnosti"
          className="h-12 w-32 shrink-0 text-accent"
        >
          <polyline points={points} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        <p className="text-sm text-text-secondary">{formatWeightKg(first)} → {formatWeightKg(last)} ({formatWeightDelta(last - first)})</p>
      </div>
    </Card>
  )
}

export default function CheckInHistory() {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(12)
  const { data: checkInResult, isLoading, error } = useCheckIns(page, pageSize)
  const checkIns = checkInResult?.data ?? []
  const totalCheckIns = checkInResult?.count ?? 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Späť na check-in" onClick={() => navigate('/check-ins')}><ArrowLeft size={22} /></button>
        <div>
          <p className="flex items-center gap-2 ledger-label text-text-secondary">
            <span className="h-3.5 w-[3px] shrink-0 rounded-full bg-accent-strong" aria-hidden="true" />
            Týždenný pokrok
          </p>
          <h1 className="mt-1 text-3xl font-display font-bold tracking-tight">História check-inov</h1>
        </div>
      </div>

      <WeightTrend checkIns={checkIns} />

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
            <div className="flex flex-col gap-2">
              <p className="ledger-label text-text-secondary">Fotky</p>
              <div className="flex gap-2">
                {checkIn.photo_front_path && (
                  <CheckInPhoto path={checkIn.photo_front_path} alt="Fotka spredu" className="h-40 w-30 rounded-lg object-cover" />
                )}
                {checkIn.photo_side_path && (
                  <CheckInPhoto path={checkIn.photo_side_path} alt="Fotka z boku" className="h-40 w-30 rounded-lg object-cover" />
                )}
              </div>
            </div>
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
      {totalCheckIns > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={totalCheckIns}
          pageSizeOptions={[12, 24, 48]}
          onPageChange={setPage}
          onPageSizeChange={size => { setPageSize(size); setPage(0) }}
          standalone
        />
      )}
    </div>
  )
}
