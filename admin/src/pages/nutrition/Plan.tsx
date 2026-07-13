import { useState } from 'react'
import { useActiveMealPlan } from '../../nutrition/hooks'
import { mealsForDay, todayDowMon0 } from '../../nutrition/mealPlan'
import { sumMacros } from '../../nutrition/calc'
import { Card, Chip, EmptyState, Shimmer } from '../../components/ui'

const DAYS = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne']

export default function Plan() {
  const { data: plan, isLoading } = useActiveMealPlan()
  const [day, setDay] = useState(todayDowMon0())

  if (isLoading) return <Shimmer className="h-40 w-full" />
  if (!plan) return <EmptyState title="Žiadny plán" message="Tréner ti zatiaľ nepriradil jedálniček." />

  const meals = mealsForDay(plan.meals ?? [], day)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Your nutrition</p>
        <h2 className="mt-1 text-3xl font-extrabold tracking-[-0.035em] text-text-primary">{plan.name}</h2>
        <p className="mt-2 text-sm text-text-secondary">Vyber deň a pozri si jedlá pripravené trénerom.</p>
      </div>
      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-outline-subtle bg-surface-elevated p-2">
        {DAYS.map((d, i) => <Chip key={d} selected={i === day} onClick={() => setDay(i)}>{d}</Chip>)}
      </div>

      {meals.length === 0 && <EmptyState title="Voľný deň" message="Na tento deň nie sú naplánované žiadne jedlá." />}

      <div className="grid items-start gap-4 lg:grid-cols-2">
      {meals.map(meal => {
        const totals = sumMacros(meal.meal_foods)
        return (
          <Card key={meal.id} className="p-5">
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="font-bold text-text-primary">{meal.name}</h3>
              {meal.time_of_day && <span className="text-xs text-text-secondary">{meal.time_of_day}</span>}
            </div>
            <ul className="mb-4 flex flex-col divide-y divide-outline-subtle">
              {meal.meal_foods.map(f => (
                <li key={f.id} className="flex justify-between gap-4 py-2.5 text-sm">
                  <span className="min-w-0 text-text-primary">{f.name}</span>
                  <span className="flex-shrink-0 text-text-secondary">{Math.round(f.amount_grams)} g · {Math.round(f.calories)} kcal</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-outline-subtle pt-3 text-xs text-text-secondary">
              <span>{Math.round(totals.calories)} kcal</span>
              <span>B {Math.round(totals.protein_g)}g</span>
              <span>S {Math.round(totals.carbs_g)}g</span>
              <span>T {Math.round(totals.fat_g)}g</span>
            </div>
          </Card>
        )
      })}
      </div>
    </div>
  )
}
