import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useFoodSearch } from '../../nutrition/hooks'
import { useLogMeal, type LogFoodInput } from '../../nutrition/mutations'
import { scaleFood } from '../../nutrition/calc'
import type { FoodRow } from '../../types/database'
import { Button, Card, Input, Shimmer } from '../../components/ui'

export default function LogMeal() {
  const navigate = useNavigate()
  const [mealName, setMealName] = useState('')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<LogFoodInput[]>([])
  // Base foods kept parallel to `items` (NOT persisted). Macros are always
  // re-scaled from the base so clearing the amount to 0 is fully recoverable.
  const [baseFoods, setBaseFoods] = useState<FoodRow[]>([])
  const { data: results, isFetching } = useFoodSearch(query)
  const logMeal = useLogMeal()

  function addFood(food: FoodRow) {
    const scaled = scaleFood(food, food.serving_size)
    setItems((currentItems) => [
      ...currentItems,
      {
        name: scaled.name,
        amount: scaled.amount,
        unit: scaled.unit,
        calories: scaled.calories,
        protein_g: scaled.protein_g,
        carbs_g: scaled.carbs_g,
        fat_g: scaled.fat_g,
      },
    ])
    setBaseFoods((currentBases) => [...currentBases, food])
    setQuery('')
  }

  function setAmount(index: number, amount: number) {
    setItems((currentItems) => currentItems.map((item, itemIndex) => {
      if (itemIndex !== index) return item

      const base = baseFoods[index]
      // Fall back to just updating the amount if the base is missing.
      if (!base) return { ...item, amount }

      // Always scale from the BASE food, never from the previous (possibly
      // zeroed) values, so retyping a real amount recovers the macros.
      const scaled = scaleFood(base, amount)
      return {
        ...item,
        amount: scaled.amount,
        unit: scaled.unit,
        calories: scaled.calories,
        protein_g: scaled.protein_g,
        carbs_g: scaled.carbs_g,
        fat_g: scaled.fat_g,
      }
    }))
  }

  function removeItem(index: number) {
    setItems((currentItems) => currentItems.filter((_, itemIndex) => itemIndex !== index))
    setBaseFoods((currentBases) => currentBases.filter((_, itemIndex) => itemIndex !== index))
  }

  async function save() {
    if (!mealName || items.length === 0) return

    await logMeal.mutateAsync({ mealName, foods: items })
    navigate('/nutrition')
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Nutrition log</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.035em] text-text-primary">Zapísať jedlo</h1>
        <p className="mt-2 text-sm text-text-secondary">Pomenuj jedlo, vyhľadaj potraviny a uprav porcie.</p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <Card className="flex flex-col gap-5 p-5 sm:p-6">
          <Input id="mealName" label="Názov jedla" placeholder="napr. Obed" value={mealName} onChange={(event) => setMealName(event.target.value)} />
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-text-primary">Vybrané potraviny</h2>
              <span className="text-xs text-text-secondary">{items.length} položiek</span>
            </div>
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-outline p-6 text-center text-sm text-text-secondary">Vyhľadaj a pridaj prvú potravinu.</div>
            ) : (
              <div className="flex flex-col divide-y divide-outline-subtle rounded-xl border border-outline-subtle">
                {items.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="flex flex-wrap items-center gap-2 p-3 sm:flex-nowrap">
                    <span className="min-w-36 flex-1 text-sm font-medium text-text-primary">{item.name}</span>
                    <input aria-label={`Množstvo ${item.name}`} type="number" min={0} value={Math.round(item.amount)} onChange={(event) => setAmount(index, Number(event.target.value))} className="h-9 w-20 rounded-lg border border-outline bg-surface px-2 text-sm text-text-primary outline-none focus:border-accent" />
                    <span className="w-7 text-xs text-text-secondary">{item.unit}</span>
                    <span className="w-18 text-right text-xs text-text-secondary">{Math.round(item.calories)} kcal</span>
                    <button type="button" aria-label={`Odstrániť ${item.name}`} onClick={() => removeItem(index)} className="rounded-lg p-2 text-text-secondary hover:bg-surface-highest hover:text-error"><X size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Button className="w-full sm:self-end sm:w-auto" loading={logMeal.isPending} disabled={!mealName || items.length === 0} onClick={save}>Uložiť jedlo</Button>
        </Card>

        <Card className="flex flex-col gap-4 p-5 sm:p-6 lg:sticky lg:top-0">
          <div>
            <h2 className="font-bold text-text-primary">Pridať potravinu</h2>
            <p className="mt-1 text-xs text-text-secondary">Vyhľadávaj podľa názvu alebo značky.</p>
          </div>
          <div className="relative">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
            <Input id="foodSearch" label="Hľadať" placeholder="napr. kuracie prsia" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-10" />
          </div>
          {isFetching && <Shimmer className="h-12 w-full" />}
          {(results ?? []).length > 0 && (
            <div className="flex max-h-[430px] flex-col divide-y divide-outline-subtle overflow-y-auto rounded-xl border border-outline-subtle">
              {results!.map((food) => (
                <button key={food.id} type="button" onClick={() => addFood(food)} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-left hover:bg-surface-highest">
                  <span className="text-sm text-text-primary">{food.name}{food.brand ? ` · ${food.brand}` : ''}</span>
                  <span className="flex-shrink-0 text-xs text-text-secondary">{Math.round(food.calories)} kcal / {Math.round(food.serving_size)}{food.serving_unit}</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
