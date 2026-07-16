import { useState } from 'react'
import { ChevronLeft, Pencil, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMealHistory } from '../../nutrition/hooks'
import { sumMacros } from '../../nutrition/calc'
import { useDeleteMealLog } from '../../nutrition/mutations'
import { Button, Card, ConfirmDialog, EmptyState, Shimmer, StatRow, useNotice } from '../../components/ui'

export default function HistoryDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: logs, isLoading } = useMealHistory()
  const { notify } = useNotice()
  const deleteMealLog = useDeleteMealLog()
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (isLoading) return <Shimmer className="h-64 w-full" />

  const log = (logs ?? []).find((entry) => entry.id === id)
  if (!log) return <EmptyState title="Záznam sa nenašiel" />

  const totals = sumMacros(log.meal_log_foods)

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 self-start text-sm font-medium text-text-secondary hover:text-text-primary"
      >
        <ChevronLeft size={16} /> Späť
      </button>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Meal detail</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.035em] text-text-primary">{log.meal_name}</h1>
        </div>
        <div className="flex gap-2">
          <Link to={`/nutrition/log?logId=${log.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-outline bg-surface px-4 text-sm font-semibold text-text-primary no-underline hover:bg-surface-elevated">
            <Pencil size={15} aria-hidden="true" /> Upraviť
          </Link>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={15} aria-hidden="true" /> Vymazať
          </Button>
        </div>
      </div>
      {log.image_url && <img src={log.image_url} alt={log.meal_name} className="max-h-[520px] w-full rounded-2xl object-cover" />}
      <Card className="p-5">
        <StatRow
          items={[
            { label: 'Kcal', value: String(Math.round(totals.calories)) },
            { label: 'Bielk.', value: `${Math.round(totals.protein_g)}g` },
            { label: 'Sach.', value: `${Math.round(totals.carbs_g)}g` },
            { label: 'Tuky', value: `${Math.round(totals.fat_g)}g` },
          ]}
        />
      </Card>
      <Card className="p-5">
        <h2 className="mb-3 font-bold text-text-primary">Potraviny</h2>
        <ul className="flex flex-col divide-y divide-outline-subtle">
          {log.meal_log_foods.map((food) => (
            <li key={food.id} className="flex justify-between gap-4 py-3 text-sm">
              <span className="text-text-primary">{food.name}</span>
              <span className="text-text-secondary">
                {Math.round(food.amount)} {food.unit} · {Math.round(food.calories)} kcal
              </span>
            </li>
          ))}
        </ul>
      </Card>
      {log.notes && <Card className="p-5"><h2 className="mb-2 font-bold text-text-primary">Poznámka</h2><p className="text-sm leading-6 text-text-secondary">{log.notes}</p></Card>}
      <ConfirmDialog
        open={deleteOpen}
        title="Vymazať tento záznam?"
        description="Jedlo aj jeho fotografia budú natrvalo odstránené."
        confirmLabel="Vymazať"
        cancelLabel="Zrušiť"
        pending={deleteMealLog.isPending}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMealLog.mutate({ logId: log.id, imageUrl: log.image_url }, {
          onSuccess: () => {
            notify('Záznam bol vymazaný.')
            navigate('/nutrition/history')
          },
          onError: () => notify('Záznam sa nepodarilo vymazať.', 'error'),
        })}
      />
    </div>
  )
}
