import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, UtensilsCrossed } from 'lucide-react'
import { useMealHistory } from '../../nutrition/hooks'
import { groupByDay } from '../../nutrition/history'
import { sumMacros } from '../../nutrition/calc'
import { Card, EmptyState, Pagination, SectionHeader, Shimmer } from '../../components/ui'
import { MealPhoto } from '../../components/MealPhoto'
import { MEAL_TYPE_OPTIONS } from '../../nutrition/constants'

export default function History() {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(24)
  const { data: historyResult, isLoading, isFetching } = useMealHistory(page, pageSize)
  const logs = historyResult?.data ?? []
  const totalLogs = historyResult?.count ?? 0
  const groups = groupByDay(logs)

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="flex items-center gap-2 ledger-label text-text-secondary">
          <span className="h-3.5 w-[3px] shrink-0 rounded-full bg-accent-strong" aria-hidden="true" />
          Záznamy stravy
        </p>
        <h2 className="mt-1 text-3xl font-display font-bold tracking-tight text-text-primary">História jedál</h2>
        <p className="mt-2 text-sm text-text-secondary">Prehľad všetkého, čo si si zapísal.</p>
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1].map(index => (
            <Shimmer key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          title="Zatiaľ žiadne záznamy"
          message="Tvoje zapísané jedlá sa zobrazia tu."
          action={
            <Link to="/nutrition/log" className="inline-flex min-h-10 items-center rounded-xl bg-action-primary px-4 text-sm font-bold text-on-action-primary no-underline">
              Zapísať prvé jedlo
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-8" aria-busy={isFetching}>
          {groups.map(group => (
            <section key={group.date}>
              <SectionHeader title={group.date} />
              <div className="grid gap-3 lg:grid-cols-2">
                {group.logs.map(log => {
                  const totals = sumMacros(log.meal_log_foods)

                  return (
                    <Card key={log.id} className="group flex cursor-pointer items-center justify-between gap-4 p-5 transition-colors hover:bg-surface-highest" onClick={() => navigate(`/nutrition/history/${log.id}`)}>
                      <div className="flex min-w-0 items-center gap-3">
                        {log.image_url ? (
                          <span className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-surface">
                            <MealPhoto path={log.image_url} alt="" className="h-full w-full object-cover" />
                          </span>
                        ) : (
                          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-surface text-text-secondary">
                            <UtensilsCrossed size={18} />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-text-primary">{log.meal_name}</p>
                          <p className="text-xs text-text-secondary">
                            {MEAL_TYPE_OPTIONS.find(option => option.value === log.meal_type)?.label ?? 'Jedlo'} ·{' '}
                            {new Date(log.logged_at).toLocaleTimeString('sk-SK', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-right">
                          <span className="ds-metric-sm block text-text-primary">{Math.round(totals.calories)}</span>
                          <span className="text-[10px] uppercase tracking-wide text-text-secondary">kcal</span>
                        </span>
                        <ArrowRight size={17} className="text-text-secondary transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </Card>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      {totalLogs > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={totalLogs}
          pageSizeOptions={[12, 24, 48]}
          onPageChange={setPage}
          onPageSizeChange={size => { setPageSize(size); setPage(0) }}
          standalone
        />
      )}
    </div>
  )
}
