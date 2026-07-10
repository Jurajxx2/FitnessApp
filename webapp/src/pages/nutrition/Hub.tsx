import { useNavigate } from 'react-router-dom'
import { useDailySummary, useMacroTargets, useRecipes } from '../../nutrition/hooks'
import { todayIso } from '../../nutrition/date'
import { Card, SectionHeader, Button, Shimmer, MacroRing } from '../../components/ui'

export default function Hub() {
  const navigate = useNavigate()
  const { data: summary, isLoading } = useDailySummary(todayIso())
  const targets = useMacroTargets()
  const { data: recipes } = useRecipes()
  const featured = (recipes ?? []).filter(r => r.featured).slice(0, 5)

  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionHeader title="Dnes" />
        <Card>
          {isLoading ? (
            <div className="flex justify-around">
              <Shimmer className="w-24 h-24 rounded-full" />
              <Shimmer className="w-24 h-24 rounded-full" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 place-items-center">
              <MacroRing label="Kcal" value={summary.calories} target={targets?.calories} unit="" />
              <MacroRing label="Bielk." value={summary.protein_g} target={targets?.protein_g} unit="g" />
              <MacroRing label="Sach." value={summary.carbs_g} target={targets?.carbs_g} unit="g" />
              <MacroRing label="Tuky" value={summary.fat_g} target={targets?.fat_g} unit="g" />
            </div>
          )}
          <Button className="w-full mt-4" onClick={() => navigate('/nutrition/log')}>+ Zapísať jedlo</Button>
        </Card>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <Card className="cursor-pointer text-center py-3" onClick={() => navigate('/nutrition/plan')}>
          <p className="text-sm font-semibold text-text-primary">Plán</p>
        </Card>
        <Card className="cursor-pointer text-center py-3" onClick={() => navigate('/nutrition/recipes')}>
          <p className="text-sm font-semibold text-text-primary">Recepty</p>
        </Card>
        <Card className="cursor-pointer text-center py-3" onClick={() => navigate('/nutrition/history')}>
          <p className="text-sm font-semibold text-text-primary">História</p>
        </Card>
      </section>

      {featured.length > 0 && (
        <section>
          <SectionHeader title="Odporúčané recepty" />
          <div className="flex gap-3 overflow-x-auto pb-2">
            {featured.map(r => (
              <Card key={r.id} className="min-w-40 cursor-pointer" onClick={() => navigate(`/nutrition/recipes/${r.id}`)}>
                {r.photo_url && <img src={r.photo_url} alt={r.name} className="w-full h-24 object-cover rounded-lg mb-2" />}
                <p className="text-sm font-semibold text-text-primary line-clamp-2">{r.name}</p>
                <p className="text-xs text-text-secondary">{Math.round(r.calories)} kcal</p>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
