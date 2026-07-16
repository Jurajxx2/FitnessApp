import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Heart, PlayCircle, Search } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { getExercise, getExercises, getFavoriteExerciseIds, setExerciseFavorite } from '../../activity/api'
import { useAuth } from '../../hooks/useAuth'
import { ActivityPage, ErrorBlock, ExerciseVisual, LoadingBlock, PageIntro } from './shared'

export default function Exercises() {
  const { exerciseId } = useParams()
  return exerciseId ? <ExerciseDetail exerciseId={exerciseId} /> : <ExerciseList />
}

function ExerciseList() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const exerciseQuery = useQuery({
    queryKey: ['activity', 'exercises'],
    queryFn: getExercises,
    enabled: Boolean(userId)
  })
  const favoritesQuery = useQuery({
    queryKey: ['activity', 'exercise-favorites', userId],
    queryFn: () => getFavoriteExerciseIds(userId),
    enabled: Boolean(userId)
  })
  const favoriteIds = useMemo(() => new Set(favoritesQuery.data ?? []), [favoritesQuery.data])
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (exerciseQuery.data ?? []).filter(exercise => {
      const matchesSearch = !term || exercise.name_en.toLowerCase().includes(term) || exercise.name_cs?.toLowerCase().includes(term) || exercise.primary_muscles.some(muscle => muscle.toLowerCase().includes(term))
      return matchesSearch && (!difficulty || exercise.difficulty === difficulty) && (!favoritesOnly || favoriteIds.has(exercise.id))
    })
  }, [difficulty, exerciseQuery.data, favoriteIds, favoritesOnly, search])

  if (exerciseQuery.isLoading || favoritesQuery.isLoading)
    return (
      <ActivityPage>
        <LoadingBlock label="Načítava sa knižnica cvikov…" />
      </ActivityPage>
    )
  if (exerciseQuery.isError || favoritesQuery.isError)
    return (
      <ActivityPage>
        <ErrorBlock message="Knižnicu cvikov sa nepodarilo načítať." />
      </ActivityPage>
    )

  return (
    <ActivityPage>
      <PageIntro eyebrow="Aktivita" title="Knižnica cvikov" description="Vyhľadaj cviky, pozri si technické pokyny a ulož si obľúbené pre rýchly prístup." />
      <div className="grid gap-3 rounded-2xl border border-outline bg-surface-elevated p-4 sm:grid-cols-[1fr_auto_auto]">
        <label className="relative">
          <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <span className="sr-only">Hľadať cviky</span>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Hľadať cvik alebo sval…" className="h-11 w-full rounded-xl border border-outline bg-surface pl-10 pr-3 text-sm text-text-primary outline-none focus:border-accent" />
        </label>
        <select aria-label="Filtrovať podľa náročnosti" value={difficulty} onChange={event => setDifficulty(event.target.value)} className="h-11 rounded-xl border border-outline bg-surface px-3 text-sm text-text-primary">
          <option value="">Všetky úrovne</option>
          <option value="beginner">Začiatočník</option>
          <option value="intermediate">Stredne pokročilý</option>
          <option value="advanced">Pokročilý</option>
        </select>
        <button type="button" onClick={() => setFavoritesOnly(value => !value)} className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold ${favoritesOnly ? 'border-accent bg-accent/10 text-text-accent' : 'border-outline bg-surface text-text-primary'}`}>
          <Heart size={16} fill={favoritesOnly ? 'currentColor' : 'none'} /> Obľúbené
        </button>
      </div>
      <p className="text-sm text-text-secondary">{visible.length} cvikov</p>
      {visible.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map(exercise => (
            <Link key={exercise.id} to={`/activity/exercises/${exercise.id}`} className="group overflow-hidden rounded-2xl border border-outline bg-surface-elevated text-inherit no-underline hover:bg-surface-highest">
              <ExerciseVisual exercise={exercise} name={exercise.name_en} className="aspect-[4/3] w-full" />
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-bold text-text-primary">{exercise.name_cs || exercise.name_en}</h3>
                    <p className="mt-1 truncate text-xs text-text-secondary">{exercise.primary_muscles.join(' · ') || exercise.exercise_categories?.name || 'Cvik'}</p>
                  </div>
                  {favoriteIds.has(exercise.id) && <Heart size={16} fill="currentColor" className="text-text-accent" />}
                </div>
                {exercise.difficulty && <span className="mt-3 inline-block rounded-full bg-surface-highest px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-text-secondary">{exercise.difficulty}</span>}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-outline p-8 text-center text-sm text-text-secondary">Žiadne cviky nezodpovedajú týmto filtrom.</div>
      )}
    </ActivityPage>
  )
}

function ExerciseDetail({ exerciseId }: { exerciseId: string }) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const queryClient = useQueryClient()
  const exerciseQuery = useQuery({
    queryKey: ['activity', 'exercise', exerciseId],
    queryFn: () => getExercise(exerciseId),
    enabled: Boolean(userId)
  })
  const favoritesQuery = useQuery({
    queryKey: ['activity', 'exercise-favorites', userId],
    queryFn: () => getFavoriteExerciseIds(userId),
    enabled: Boolean(userId)
  })
  const favorite = (favoritesQuery.data ?? []).includes(exerciseId)
  const favoriteMutation = useMutation({
    mutationFn: () => setExerciseFavorite(userId, exerciseId, !favorite),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['activity', 'exercise-favorites', userId]
      })
  })
  if (exerciseQuery.isLoading || favoritesQuery.isLoading)
    return (
      <ActivityPage>
        <LoadingBlock label="Načítava sa cvik…" />
      </ActivityPage>
    )
  if (exerciseQuery.isError || favoritesQuery.isError || !exerciseQuery.data)
    return (
      <ActivityPage>
        <ErrorBlock message="Tento cvik sa nepodarilo načítať." />
      </ActivityPage>
    )
  const exercise = exerciseQuery.data
  const title = exercise.name_cs || exercise.name_en
  const description = exercise.description_cs || exercise.description_en

  return (
    <ActivityPage>
      <Link to="/activity/exercises" className="inline-flex items-center gap-2 text-sm font-semibold text-text-secondary no-underline hover:text-text-primary">
        <ArrowLeft size={16} /> Knižnica cvikov
      </Link>
      <div className="grid overflow-hidden rounded-3xl border border-outline bg-surface-elevated lg:grid-cols-2">
        <ExerciseVisual exercise={exercise} name={title} className="aspect-[4/3] h-full w-full" />
        <div className="p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-accent">{exercise.exercise_categories?.name ?? 'Cvik'}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-text-primary">{title}</h2>
          {exercise.name_cs && <p className="mt-1 text-sm text-text-secondary">{exercise.name_en}</p>}
          <button type="button" onClick={() => favoriteMutation.mutate()} disabled={favoriteMutation.isPending} className={`mt-5 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-semibold ${favorite ? 'border-accent bg-accent/10 text-text-accent' : 'border-outline bg-surface text-text-primary'}`}>
            <Heart size={16} fill={favorite ? 'currentColor' : 'none'} /> {favorite ? 'Uložené medzi obľúbené' : 'Uložiť medzi obľúbené'}
          </button>
          {description && <p className="mt-6 whitespace-pre-line text-sm leading-7 text-text-secondary">{description}</p>}
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-text-secondary">Náročnosť</dt>
              <dd className="mt-1 text-text-primary">{exercise.difficulty ?? 'Neuvedené'}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-text-secondary">Vybavenie</dt>
              <dd className="mt-1 text-text-primary">{exercise.equipment_names.join(', ') || 'Žiadne'}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-text-secondary">Hlavné svaly</dt>
              <dd className="mt-1 text-text-primary">{exercise.primary_muscles.join(', ') || 'Neuvedené'}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-text-secondary">Vedľajšie svaly</dt>
              <dd className="mt-1 text-text-primary">{exercise.secondary_muscles.join(', ') || 'Neuvedené'}</dd>
            </div>
          </dl>
          {exercise.video_url && (
            <a href={exercise.video_url} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-text-accent">
              <PlayCircle size={18} /> Pozrieť ukážku
            </a>
          )}
          {favoriteMutation.isError && (
            <p role="alert" className="mt-3 text-sm text-error">
              {favoriteMutation.error.message}
            </p>
          )}
        </div>
      </div>
    </ActivityPage>
  )
}
