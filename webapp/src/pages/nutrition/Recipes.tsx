import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { useRecipes, useFavorites } from '../../nutrition/hooks'
import { useToggleFavorite } from '../../nutrition/mutations'
import { Card, Chip, SectionHeader, EmptyState, Shimmer } from '../../components/ui'

export default function Recipes() {
  const navigate = useNavigate()
  const { data: recipes, isLoading } = useRecipes()
  const { data: favorites } = useFavorites()
  const toggle = useToggleFavorite()
  const [onlyFavs, setOnlyFavs] = useState(false)

  if (isLoading) return <div className="flex flex-col gap-3">{[0, 1, 2].map(i => <Shimmer key={i} className="h-28 w-full" />)}</div>

  const favSet = favorites ?? new Set<string>()
  const list = (recipes ?? [])
    .filter(r => !onlyFavs || favSet.has(r.id))
    .sort((a, b) => Number(b.featured) - Number(a.featured))

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader title="Recepty" action={<Chip selected={onlyFavs} onClick={() => setOnlyFavs(v => !v)}>Obľúbené</Chip>} />
      {list.length === 0 && <EmptyState title="Žiadne recepty" />}
      {list.map(r => {
        const isFav = favSet.has(r.id)
        return (
          <Card key={r.id} className="flex gap-3 cursor-pointer" onClick={() => navigate(`/nutrition/recipes/${r.id}`)}>
            {r.photo_url && <img src={r.photo_url} alt={r.name} className="w-20 h-20 object-cover rounded-lg" />}
            <div className="flex-1">
              <p className="font-semibold text-text-primary">{r.name}</p>
              <p className="text-xs text-text-secondary">{Math.round(r.calories)} kcal · B {Math.round(r.protein_g)}g</p>
            </div>
            <button
              aria-label="favorite"
              onClick={e => { e.stopPropagation(); toggle.mutate({ recipeId: r.id, isFavorite: isFav }) }}
              className="self-start p-1"
            >
              <Heart size={20} className={isFav ? 'fill-accent text-accent' : 'text-text-secondary'} />
            </button>
          </Card>
        )
      })}
    </div>
  )
}
