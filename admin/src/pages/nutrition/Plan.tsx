import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Plus } from 'lucide-react'
import { useActiveMealPlan } from '../../nutrition/hooks'
import { mealsForDay, todayDowMon0 } from '../../nutrition/mealPlan'
import { sumMacros } from '../../nutrition/calc'
import { Button, Card, Chip, EmptyState, Shimmer } from '../../components/ui'

const DAYS = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne']

export default function Plan({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate()
  const { data: plan, isLoading } = useActiveMealPlan()
  const [day, setDay] = useState(todayDowMon0())

  if (isLoading) return <Shimmer className="h-40 w-full" />
  if (!plan) return <EmptyState title="Žiadny plán" message="Tréner ti zatiaľ nepriradil jedálniček." />

  const meals = mealsForDay(plan.meals ?? [], day)

  return (
    <div className="flex flex-col gap-6">
      <div>
        {!embedded && <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Your nutrition</p>}
        <h2 className={`${embedded ? 'text-2xl' : 'mt-1 text-3xl'} font-extrabold tracking-[-0.035em] text-text-primary`}>{plan.name}</h2>
        <p className="mt-2 text-sm text-text-secondary">Vyber deň a pozri si jedlá pripravené trénerom.</p>
      </div>
      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-outline-subtle bg-surface-elevated p-2">
        {DAYS.map((d, i) => <Chip key={d} selected={i === day} onClick={() => setDay(i)}>{d}</Chip>)}
      </div>

      {meals.length === 0 && <EmptyState title="Voľný deň" message="Na tento deň nie sú naplánované žiadne jedlá." />}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {meals.map(meal => {
          const totals = sumMacros(meal.meal_foods)
          const recipeIdBySnapshotName = new Map(
            meal.meal_plan_recipes
              .filter(recipe => recipe.recipe_id && recipe.snapshot_recipe_name)
              .map(recipe => [recipe.snapshot_recipe_name!, recipe.recipe_id!]),
          )
          const multiplierBySnapshotName = new Map(
            meal.meal_plan_recipes
              .filter(recipe => recipe.snapshot_recipe_name && recipe.portion_multiplier !== 1)
              .map(recipe => [recipe.snapshot_recipe_name!, recipe.portion_multiplier]),
          )
          return (
            <Card key={meal.id} className="p-5">
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="font-bold text-text-primary">{meal.name}</h3>
              {meal.time_of_day && <span className="text-xs text-text-secondary">{meal.time_of_day}</span>}
            </div>
            <ul className="mb-4 flex flex-col divide-y divide-outline-subtle">
              {meal.meal_foods.map(f => {
                const recipeId = recipeIdBySnapshotName.get(f.name)
                const content = (
                  <>
                    <span className="flex min-w-0 items-center gap-1 font-medium text-text-primary">
                      <span className="truncate">{f.name}</span>
                      {multiplierBySnapshotName.has(f.name) && (
                        <span className="flex-shrink-0 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                          {multiplierBySnapshotName.get(f.name)}× porcia
                        </span>
                      )}
                      {recipeId && <ChevronRight size={15} className="flex-shrink-0 text-accent" aria-hidden="true" />}
                    </span>
                    <span className="flex-shrink-0 text-text-secondary">{Math.round(f.amount_grams)} g · {Math.round(f.calories)} kcal</span>
                  </>
                )

                return (
                  <li key={f.id} className="text-sm">
                    {recipeId ? (
                      <Link
                        to={`/nutrition/recipes/${recipeId}`}
                        aria-label={`Otvoriť recept ${f.name}`}
                        className="flex min-h-11 items-center justify-between gap-4 rounded-lg py-2.5 outline-none transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="flex min-h-11 items-center justify-between gap-4 py-2.5">{content}</div>
                    )}
                  </li>
                )
              })}
            </ul>
            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-outline-subtle pt-3 text-xs text-text-secondary">
              <span>{Math.round(totals.calories)} kcal</span>
              <span>B {Math.round(totals.protein_g)}g</span>
              <span>S {Math.round(totals.carbs_g)}g</span>
              <span>T {Math.round(totals.fat_g)}g</span>
            </div>
            <Button variant="secondary" className="mt-4 w-full" onClick={() => navigate(`/nutrition/log?mealId=${meal.id}`)}>
              <Plus size={16} aria-hidden="true" /> Zapísať toto jedlo
            </Button>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
