import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Heart, Search } from 'lucide-react'
import { useRecipes, useFavorites } from '../../nutrition/hooks'
import { useToggleFavorite } from '../../nutrition/mutations'
import { Card, Chip, EmptyState, Shimmer } from '../../components/ui'

export default function Recipes({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate()
  const { data: recipes, isLoading } = useRecipes()
  const { data: favorites } = useFavorites()
  const toggle = useToggleFavorite()
  const [onlyFavs, setOnlyFavs] = useState(false)
  const [query, setQuery] = useState('')

  if (isLoading) return <div className="flex flex-col gap-3">{[0, 1, 2].map(i => <Shimmer key={i} className="h-28 w-full" />)}</div>

  const favSet = favorites ?? new Set<string>()
  const list = (recipes ?? [])
    .filter(r => !onlyFavs || favSet.has(r.id))
    .filter(r => r.name.toLocaleLowerCase('sk').includes(query.trim().toLocaleLowerCase('sk')))
    .sort((a, b) => Number(b.featured) - Number(a.featured))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          {!embedded && <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Recipe library</p>}
          <h2 className={`${embedded ? 'text-2xl' : 'mt-1 text-3xl'} font-extrabold tracking-[-0.035em] text-text-primary`}>Recepty</h2>
          <p className="mt-2 text-sm text-text-secondary">Jedlá vybrané pre tvoje ciele a makrá.</p>
        </div>
        <Chip selected={onlyFavs} onClick={() => setOnlyFavs(v => !v)}>Obľúbené</Chip>
      </div>
      <label className="relative block max-w-xl">
        <span className="sr-only">Hľadať recepty</span>
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Hľadať recepty…" className="h-12 w-full rounded-xl border border-outline bg-surface pl-11 pr-4 text-sm text-text-primary outline-none placeholder:text-text-secondary focus:border-accent" />
      </label>
      {list.length === 0 && <EmptyState title="Žiadne recepty" />}
      <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {list.map(r => {
        const isFav = favSet.has(r.id)
        return (
          <Card key={r.id} className="group cursor-pointer overflow-hidden p-0" onClick={() => navigate(`/nutrition/recipes/${r.id}`)}>
            <div className="relative aspect-[16/10] overflow-hidden bg-surface-highest">
              {r.photo_url ? <img src={r.photo_url} alt={r.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" /> : <div className="flex h-full items-center justify-center text-text-secondary"><BookOpen size={28} /></div>}
              <button aria-label="favorite" onClick={e => { e.stopPropagation(); toggle.mutate({ recipeId: r.id, isFavorite: isFav }) }} className="absolute right-3 top-3 rounded-full border border-outline-subtle bg-background/85 p-2 backdrop-blur">
                <Heart size={18} className={isFav ? 'fill-accent text-accent' : 'text-text-secondary'} />
              </button>
            </div>
            <div className="p-4">
              <p className="font-semibold text-text-primary">{r.name}</p>
              <p className="mt-1 text-xs text-text-secondary">{Math.round(r.calories)} kcal · B {Math.round(r.protein_g)}g</p>
            </div>
          </Card>
        )
      })}
      </div>
    </div>
  )
}
