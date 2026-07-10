import { ChevronLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMealHistory } from '../../nutrition/hooks'
import { sumMacros } from '../../nutrition/calc'
import { Card, EmptyState, Shimmer, StatRow } from '../../components/ui'

export default function HistoryDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: logs, isLoading } = useMealHistory()

  if (isLoading) return <Shimmer className="h-64 w-full" />

  const log = (logs ?? []).find((entry) => entry.id === id)
  if (!log) return <EmptyState title="Záznam sa nenašiel" />

  const totals = sumMacros(log.meal_log_foods)

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 self-start text-sm text-text-secondary"
      >
        <ChevronLeft size={16} /> Späť
      </button>
      <h1 className="text-xl font-bold text-text-primary">{log.meal_name}</h1>
      <Card>
        <StatRow
          items={[
            { label: 'Kcal', value: String(Math.round(totals.calories)) },
            { label: 'Bielk.', value: `${Math.round(totals.protein_g)}g` },
            { label: 'Sach.', value: `${Math.round(totals.carbs_g)}g` },
            { label: 'Tuky', value: `${Math.round(totals.fat_g)}g` },
          ]}
        />
      </Card>
      <ul className="flex flex-col gap-1">
        {log.meal_log_foods.map((food) => (
          <li key={food.id} className="flex justify-between text-sm">
            <span className="text-text-primary">{food.name}</span>
            <span className="text-text-secondary">
              {Math.round(food.amount)} {food.unit} · {Math.round(food.calories)} kcal
            </span>
          </li>
        ))}
      </ul>
      {log.notes && <p className="text-sm text-text-secondary">{log.notes}</p>}
    </div>
  )
}
