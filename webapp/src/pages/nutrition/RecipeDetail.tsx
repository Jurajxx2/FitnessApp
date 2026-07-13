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
    <div className="flex flex-col gap-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 self-start text-sm font-medium text-text-secondary hover:text-text-primary">
        <ChevronLeft size={16} /> Späť
      </button>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <div className="flex flex-col gap-6">
          {recipe.photo_url && <img src={recipe.photo_url} alt={recipe.name} className="aspect-[16/9] w-full rounded-2xl object-cover" />}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Recipe</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.035em] text-text-primary">{recipe.name}</h1>
            {recipe.description && <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">{recipe.description}</p>}
          </div>
          {steps.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-bold text-text-primary">Postup</h2>
              <ol className="flex flex-col gap-3">
                {steps.map(s => (
                  <li key={s.id} className="flex gap-4 rounded-2xl border border-outline-subtle bg-surface-elevated p-4 text-sm">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-on-accent">{s.step_number}</span>
                    <span className="pt-1 text-text-primary">{s.instruction}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-0">
          <Card className="p-5">
            <StatRow items={[
              { label: 'Kcal', value: String(Math.round(recipe.calories)) },
              { label: 'Bielk.', value: `${Math.round(recipe.protein_g)}g` },
              { label: 'Sach.', value: `${Math.round(recipe.carbs_g)}g` },
              { label: 'Tuky', value: `${Math.round(recipe.fat_g)}g` },
            ]} />
          </Card>
      {ingredients.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-3 font-bold text-text-primary">Ingrediencie</h2>
          <ul className="flex flex-col divide-y divide-outline-subtle">
            {ingredients.map(i => (
              <li key={i.id} className="flex justify-between gap-4 py-2.5 text-sm">
                <span className="text-text-primary">{i.name}</span>
                <span className="text-text-secondary">{i.quantity ?? ''} {i.unit ?? ''}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
        </aside>
      </div>
    </div>
  )
}
