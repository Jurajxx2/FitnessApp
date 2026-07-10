import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useRecipe } from '../../nutrition/hooks'
import { Card, StatRow, EmptyState, Shimmer } from '../../components/ui'

export default function RecipeDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: recipe, isLoading } = useRecipe(id)

  if (isLoading) return <Shimmer className="h-64 w-full" />
  if (!recipe) return <EmptyState title="Recept sa nenašiel" />

  const ingredients = recipe.recipe_ingredients ?? []
  const steps = (recipe.recipe_steps ?? []).slice().sort((a, b) => a.step_number - b.step_number)

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-text-secondary">
        <ChevronLeft size={16} /> Späť
      </button>
      {recipe.photo_url && <img src={recipe.photo_url} alt={recipe.name} className="w-full h-52 object-cover rounded-2xl" />}
      <h1 className="text-xl font-bold text-text-primary">{recipe.name}</h1>
      {recipe.description && <p className="text-sm text-text-secondary">{recipe.description}</p>}

      <Card>
        <StatRow items={[
          { label: 'Kcal', value: String(Math.round(recipe.calories)) },
          { label: 'Bielk.', value: `${Math.round(recipe.protein_g)}g` },
          { label: 'Sach.', value: `${Math.round(recipe.carbs_g)}g` },
          { label: 'Tuky', value: `${Math.round(recipe.fat_g)}g` },
        ]} />
      </Card>

      {ingredients.length > 0 && (
        <section>
          <h2 className="font-bold text-text-primary mb-2">Ingrediencie</h2>
          <ul className="flex flex-col gap-1">
            {ingredients.map(i => (
              <li key={i.id} className="flex justify-between text-sm">
                <span className="text-text-primary">{i.name}</span>
                <span className="text-text-secondary">{i.quantity ?? ''} {i.unit ?? ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {steps.length > 0 && (
        <section>
          <h2 className="font-bold text-text-primary mb-2">Postup</h2>
          <ol className="flex flex-col gap-3">
            {steps.map(s => (
              <li key={s.id} className="flex gap-3 text-sm">
                <span className="ds-metric-sm text-accent">{s.step_number}</span>
                <span className="text-text-primary pt-1">{s.instruction}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
