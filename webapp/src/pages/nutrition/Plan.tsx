import { useState } from 'react'
import { useActiveMealPlan } from '../../nutrition/hooks'
import { mealsForDay, todayDowMon0 } from '../../nutrition/mealPlan'
import { sumMacros } from '../../nutrition/calc'
import { Card, Chip, SectionHeader, EmptyState, Shimmer } from '../../components/ui'

const DAYS = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne']

export default function Plan() {
  const { data: plan, isLoading } = useActiveMealPlan()
  const [day, setDay] = useState(todayDowMon0())

  if (isLoading) return <Shimmer className="h-40 w-full" />
  if (!plan) return <EmptyState title="Žiadny plán" message="Tréner ti zatiaľ nepriradil jedálniček." />

  const meals = mealsForDay(plan.meals ?? [], day)

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader title={plan.name} />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DAYS.map((d, i) => <Chip key={d} selected={i === day} onClick={() => setDay(i)}>{d}</Chip>)}
      </div>

      {meals.length === 0 && <EmptyState title="Voľný deň" message="Na tento deň nie sú naplánované žiadne jedlá." />}

      {meals.map(meal => {
        const totals = sumMacros(meal.meal_foods)
        return (
          <Card key={meal.id}>
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="font-bold text-text-primary">{meal.name}</h3>
              {meal.time_of_day && <span className="text-xs text-text-secondary">{meal.time_of_day}</span>}
            </div>
            <ul className="flex flex-col gap-1 mb-3">
              {meal.meal_foods.map(f => (
                <li key={f.id} className="flex justify-between text-sm">
                  <span className="text-text-primary">{f.name}</span>
                  <span className="text-text-secondary">{Math.round(f.amount_grams)} g · {Math.round(f.calories)} kcal</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-4 text-xs text-text-secondary border-t border-outline-subtle pt-2">
              <span>{Math.round(totals.calories)} kcal</span>
              <span>B {Math.round(totals.protein_g)}g</span>
              <span>S {Math.round(totals.carbs_g)}g</span>
              <span>T {Math.round(totals.fat_g)}g</span>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
