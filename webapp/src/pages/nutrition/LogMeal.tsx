import { useState } from 'react'
import { X } from 'lucide-react'
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
    setQuery('')
  }

  function setAmount(index: number, amount: number) {
    setItems((currentItems) => currentItems.map((item, itemIndex) => {
      if (itemIndex !== index) return item

      const ratio = item.amount > 0 ? amount / item.amount : 0
      return {
        ...item,
        amount,
        calories: item.calories * ratio,
        protein_g: item.protein_g * ratio,
        carbs_g: item.carbs_g * ratio,
        fat_g: item.fat_g * ratio,
      }
    }))
  }

  function removeItem(index: number) {
    setItems((currentItems) => currentItems.filter((_, itemIndex) => itemIndex !== index))
  }

  async function save() {
    if (!mealName || items.length === 0) return

    await logMeal.mutateAsync({ mealName, foods: items })
    navigate('/nutrition')
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-text-primary">Zapísať jedlo</h1>
      <Input
        id="mealName"
        label="Názov jedla"
        placeholder="napr. Obed"
        value={mealName}
        onChange={(event) => setMealName(event.target.value)}
      />

      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((item, index) => (
            <Card key={`${item.name}-${index}`} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-text-primary">{item.name}</span>
              <input
                aria-label={`Množstvo ${item.name}`}
                type="number"
                min={0}
                value={Math.round(item.amount)}
                onChange={(event) => setAmount(index, Number(event.target.value))}
                className="h-9 w-20 rounded-lg border border-outline bg-surface px-2 text-sm text-text-primary outline-none"
              />
              <span className="w-6 text-xs text-text-secondary">{item.unit}</span>
              <span className="w-16 text-right text-xs text-text-secondary">{Math.round(item.calories)} kcal</span>
              <button
                type="button"
                aria-label={`Odstrániť ${item.name}`}
                onClick={() => removeItem(index)}
                className="text-text-secondary"
              >
                <X size={16} />
              </button>
            </Card>
          ))}
        </div>
      )}

      <Input
        id="foodSearch"
        label="Pridať potravinu"
        placeholder="Hľadať…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {isFetching && <Shimmer className="h-10 w-full" />}
      {(results ?? []).length > 0 && (
        <Card className="flex flex-col divide-y divide-outline-subtle overflow-hidden p-0">
          {results!.map((food) => (
            <button
              key={food.id}
              type="button"
              onClick={() => addFood(food)}
              className="flex items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-sm text-text-primary">
                {food.name}{food.brand ? ` · ${food.brand}` : ''}
              </span>
              <span className="text-xs text-text-secondary">
                {Math.round(food.calories)} kcal / {Math.round(food.serving_size)}{food.serving_unit}
              </span>
            </button>
          ))}
        </Card>
      )}

      <Button
        className="w-full"
        loading={logMeal.isPending}
        disabled={!mealName || items.length === 0}
        onClick={save}
      >
        Uložiť jedlo
      </Button>
    </div>
  )
}
