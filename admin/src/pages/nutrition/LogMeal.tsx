import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Camera, ChevronDown, ChevronUp, ImagePlus, Plus, Sparkles, Star, Trash2, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  useActiveMealPlan,
  useFoodFavorites,
  useFoodSearch,
  useMealLog,
  useRecentFoods,
  useRecipe,
  useSavedMeals,
  useSeedFoods,
} from '../../nutrition/hooks'
import {
  useDeleteFoodFavorite,
  useDeleteMealTemplate,
  useLogMeal,
  useSaveFoodFavorite,
  useSaveMealTemplate,
  useUpdateMealLog,
} from '../../nutrition/mutations'
import {
  draftFromFood,
  emptyIngredient,
  localDateTimeToIso,
  isUntouchedEmptyIngredient,
  mealDraftTotals,
  mealFoodsToDrafts,
  persistedFood,
  recipeIngredientsToDrafts,
  rescaleDraftAmount,
  snapshotToDraft,
  suggestMealName,
  updateDraftMacro,
  validateMealDraft,
  type LogFoodDraft,
} from '../../nutrition/logDraft'
import { scaleFood, type Macros } from '../../nutrition/calc'
import { MEAL_TYPE_OPTIONS } from '../../nutrition/constants'
import { analyzeMealPhoto, mergeAnalysis } from '../../nutrition/photoAnalysis'
import { prepareMealPhoto } from '../../nutrition/imagePreparation'
import { signedMealPhotoUrl, validateMealPhoto } from '../../lib/storage'
import type { FoodFavoriteRow, FoodRow, MealType, RecipeRow } from '../../types/database'
import { Button, Card, ConfirmDialog, EmptyState, Input, Shimmer, useNotice } from '../../components/ui'
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard'

type MacroField = keyof Macros
type LogStep = 'capture' | 'review'

function localDatePart(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function localTimePart(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function defaultMealType(date = new Date()): MealType {
  const hour = date.getHours()
  if (hour < 10) return 'breakfast'
  if (hour < 15) return 'lunch'
  if (hour < 18) return 'snack'
  return 'dinner'
}

function favoriteForDraft(favorites: FoodFavoriteRow[], draft: LogFoodDraft) {
  const name = draft.name.trim().toLocaleLowerCase('sk-SK')
  return favorites.find(favorite => favorite.name.trim().toLocaleLowerCase('sk-SK') === name) ?? null
}

function QuickAddButton({ label, detail, onClick }: { label: string; detail: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-surface-highest">
      <span className="min-w-0 truncate text-sm font-semibold text-text-primary">{label}</span>
      <span className="flex-shrink-0 text-xs text-text-secondary">{detail}</span>
    </button>
  )
}

export default function LogMeal() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const recipeId = searchParams.get('recipeId') ?? ''
  const mealId = searchParams.get('mealId') ?? ''
  const logId = searchParams.get('logId') ?? ''
  const isEdit = Boolean(logId)
  // Edit/recipe/meal-plan prefills already have a draft, so they open straight on review;
  // a fresh log begins on the photo-first capture step.
  const startsInReview = isEdit || Boolean(recipeId) || Boolean(mealId)
  const cameFromCapture = !startsInReview
  const now = useRef(new Date()).current
  const recipeQuery = useRecipe(recipeId)
  const mealPlanQuery = useActiveMealPlan(Boolean(mealId) && !recipeId)
  const mealLogQuery = useMealLog(logId)
  const favoritesQuery = useFoodFavorites()
  const recentsQuery = useRecentFoods()
  const savedMealsQuery = useSavedMeals()
  const seedFoodsQuery = useSeedFoods()
  const { notify } = useNotice()
  const [step, setStep] = useState<LogStep>(startsInReview ? 'review' : 'capture')
  const [mealName, setMealName] = useState('')
  const [mealType, setMealType] = useState<MealType>(defaultMealType(now))
  const [logDate, setLogDate] = useState(localDatePart(now))
  const [logTime, setLogTime] = useState(localTimePart(now))
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LogFoodDraft[]>(() => [emptyIngredient()])
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set([items[0].key]))
  const [recipeServings, setRecipeServings] = useState(1)
  const [savedMealName, setSavedMealName] = useState('')
  const [foodSearchTerm, setFoodSearchTerm] = useState('')
  const [debouncedFoodSearchTerm, setDebouncedFoodSearchTerm] = useState('')
  const foodSearch = useFoodSearch(debouncedFoodSearchTerm)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [removeExistingPhoto, setRemoveExistingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [processingPhoto, setProcessingPhoto] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiDescription, setAiDescription] = useState('')
  const [formError, setFormError] = useState('')
  const photoInput = useRef<HTMLInputElement>(null)
  const prefillApplied = useRef(false)
  const captureHeadingRef = useRef<HTMLHeadingElement>(null)
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null)
  const stepDidMount = useRef(false)
  // Ratchets true the moment the athlete attaches/removes a photo, adds or edits
  // an item, or removes one — deliberately NOT set by the prefill effect below,
  // so opening an existing log/recipe/meal-plan draft doesn't itself count as
  // unsaved work.
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const markDirty = () => setHasUnsavedChanges(true)
  const logMeal = useLogMeal()
  const updateMeal = useUpdateMealLog()
  const saveFavorite = useSaveFoodFavorite()
  const deleteFavorite = useDeleteFoodFavorite()
  const saveMealTemplate = useSaveMealTemplate()
  const deleteMealTemplate = useDeleteMealTemplate()
  const existingLog = isEdit ? (mealLogQuery.data ?? null) : null
  const favorites = favoritesQuery.data ?? []
  // Deliberate exits, deferred into effects keyed on each mutation's own
  // isSuccess rather than called inline right after an awaited mutateAsync.
  // An effect cannot run until React has committed a render that reflects
  // its dependency, so by the time navigate() fires here, LogMeal has
  // already re-rendered with isDirty computed from the now-true isSuccess
  // below — no manual "saved" ref or forced render needed for the guard to
  // see it in time.
  useEffect(() => {
    if (updateMeal.isSuccess) navigate(`/nutrition/history/${logId}`)
  }, [updateMeal.isSuccess, logId, navigate])
  useEffect(() => {
    if (logMeal.isSuccess) navigate('/nutrition')
  }, [logMeal.isSuccess, navigate])
  // Neither mutation needs an onError reset: once a mutation is neither
  // pending nor successful (a failed attempt included), isDirty falls
  // straight back to reflecting hasUnsavedChanges again.
  const isDirty = hasUnsavedChanges
    && !logMeal.isPending && !logMeal.isSuccess
    && !updateMeal.isPending && !updateMeal.isSuccess
  const { blocked, confirmLeave, cancelLeave } = useUnsavedChangesGuard(isDirty)

  function replaceItems(next: LogFoodDraft[]) {
    const safe = next.length ? next : [emptyIngredient()]
    setItems(safe)
    setExpandedKeys(new Set(safe.filter(item => !item.name.trim() || (item.confidence ?? 1) < 0.7).map(item => item.key)))
  }

  function addDraft(draft: LogFoodDraft, replacePristinePlaceholder = true) {
    const replacedKey = replacePristinePlaceholder && items.length === 1 && isUntouchedEmptyIngredient(items[0])
      ? items[0].key
      : null
    setItems(replacedKey ? [draft] : [...items, draft])
    setExpandedKeys(current => {
      const next = new Set(current)
      if (replacedKey) next.delete(replacedKey)
      next.add(draft.key)
      return next
    })
    markDirty()
  }

  function appendManualDraft() {
    addDraft(emptyIngredient(), false)
  }

  useEffect(() => {
    if (prefillApplied.current) return
    if (isEdit) {
      if (!existingLog) return
      const loggedAt = new Date(existingLog.logged_at)
      setMealName(existingLog.meal_name)
      setMealType(existingLog.meal_type ?? defaultMealType(loggedAt))
      setLogDate(localDatePart(loggedAt))
      setLogTime(localTimePart(loggedAt))
      setNotes(existingLog.notes ?? '')
      replaceItems(existingLog.meal_log_foods.map(food => snapshotToDraft(food, 'manual')))
      if (existingLog.image_url) {
        void signedMealPhotoUrl(existingLog.image_url).then(url => setPhotoPreview(url))
      }
      prefillApplied.current = true
      return
    }
    if (recipeId && recipeQuery.data) {
      setMealName(recipeQuery.data.name)
      replaceItems(recipeIngredientsToDrafts(recipeQuery.data, recipeServings))
      prefillApplied.current = true
      return
    }
    if (mealId && mealPlanQuery.data) {
      const meal = mealPlanQuery.data.meals.find(candidate => candidate.id === mealId)
      if (meal) {
        setMealName(meal.name)
        if (meal.time_of_day) setLogTime(meal.time_of_day.slice(0, 5))
        replaceItems(mealFoodsToDrafts(meal))
      }
      prefillApplied.current = true
    }
  }, [existingLog, isEdit, mealId, mealPlanQuery.data, recipeId, recipeQuery.data, recipeServings])

  useEffect(() => {
    if (!photoFile) {
      if (!isEdit || removeExistingPhoto) setPhotoPreview(null)
      return
    }
    const preview = URL.createObjectURL(photoFile)
    setPhotoPreview(preview)
    return () => URL.revokeObjectURL(preview)
  }, [isEdit, photoFile, removeExistingPhoto])

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedFoodSearchTerm(foodSearchTerm.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [foodSearchTerm])

  // Move focus to the incoming step's heading when the view swaps between capture and review,
  // so keyboard/screen-reader focus never falls to <body>. Skip the first render so prefills
  // (edit/recipe/meal plan) that open directly on review don't yank focus on mount.
  useEffect(() => {
    if (!stepDidMount.current) {
      stepDidMount.current = true
      return
    }
    const target = step === 'review' ? reviewHeadingRef.current : captureHeadingRef.current
    target?.focus()
  }, [step])

  function updateItem(index: number, update: (draft: LogFoodDraft) => LogFoodDraft) {
    setItems(current => current.map((item, itemIndex) => itemIndex === index ? update(item) : item))
    markDirty()
  }

  function removeItem(index: number) {
    const removedKey = items[index]?.key
    if (!removedKey) return
    markDirty()
    if (items.length === 1) {
      const replacement = emptyIngredient()
      setItems([replacement])
      setExpandedKeys(current => {
        const next = new Set(current)
        next.delete(removedKey)
        next.add(replacement.key)
        return next
      })
      return
    }
    setItems(current => current.filter(item => item.key !== removedKey))
    setExpandedKeys(current => {
      const next = new Set(current)
      next.delete(removedKey)
      return next
    })
  }

  async function selectPhoto(file: File) {
    const validationError = validateMealPhoto(file)
    if (validationError) {
      setPhotoError(validationError)
      return
    }
    setProcessingPhoto(true)
    try {
      const prepared = await prepareMealPhoto(file)
      setPhotoError('')
      setRemoveExistingPhoto(false)
      setPhotoFile(prepared)
      markDirty()
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Fotografiu sa nepodarilo pripraviť.')
    } finally {
      setProcessingPhoto(false)
    }
  }

  function clearPhoto() {
    setPhotoFile(null)
    if (isEdit) setRemoveExistingPhoto(true)
    setPhotoPreview(null)
    markDirty()
  }

  async function analyzePhoto() {
    if (!photoFile) return
    setAnalyzing(true)
    try {
      const analysis = await analyzeMealPhoto(photoFile, aiDescription)
      setItems(current => mergeAnalysis(current, analysis))
      if (!mealName.trim()) setMealName(analysis.mealName?.trim() || suggestMealName(analysis.items.map(item => item.name)) || 'Jedlo z fotografie')
      notify('Odhad bol doplnený. Pred uložením skontroluj všetky položky.', 'success')
      setStep('review')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Analýza zlyhala.', 'error')
    } finally {
      setAnalyzing(false)
    }
  }

  async function toggleFavorite(draft: LogFoodDraft) {
    if (!draft.name.trim()) return
    const existing = favoriteForDraft(favorites, draft)
    try {
      if (existing) await deleteFavorite.mutateAsync(existing.id)
      else await saveFavorite.mutateAsync(persistedFood(draft))
      notify(existing ? 'Položka bola odstránená z obľúbených.' : 'Položka bola pridaná medzi obľúbené.')
    } catch {
      notify('Obľúbenú položku sa nepodarilo upraviť.', 'error')
    }
  }

  async function saveCurrentMealTemplate() {
    const candidateItems = items.filter(item => !isUntouchedEmptyIngredient(item))
    if (candidateItems.some(item => !item.name.trim())) {
      notify('Doplň názov každej rozpracovanej položky.', 'error')
      return
    }
    const foods = candidateItems.map(persistedFood)
    if (!savedMealName.trim() || foods.length === 0) return
    try {
      await saveMealTemplate.mutateAsync({ name: savedMealName.trim(), foods })
      setSavedMealName('')
      notify('Jedlo bolo uložené medzi vlastné jedlá.')
    } catch {
      notify('Vlastné jedlo sa nepodarilo uložiť.', 'error')
    }
  }

  async function deleteSavedMeal(id: string) {
    try {
      await deleteMealTemplate.mutateAsync(id)
      notify('Vlastné jedlo bolo vymazané.')
    } catch {
      notify('Vlastné jedlo sa nepodarilo vymazať.', 'error')
    }
  }

  function save() {
    const candidateItems = items.filter(item => !isUntouchedEmptyIngredient(item))
    if (candidateItems.some(item => !item.name.trim())) {
      setFormError('Doplň názov každej rozpracovanej položky alebo ju odstráň.')
      return
    }
    const foods = candidateItems.map(persistedFood)
    const loggedAt = localDateTimeToIso(logDate, logTime)
    const validation = validateMealDraft({
      mealName,
      mealType,
      loggedAt: loggedAt ?? '',
      notes,
      entries: candidateItems,
    })
    if (!loggedAt || !validation.valid || foods.length === 0) {
      setFormError('Skontroluj názov, typ, dátum, čas a všetky výživové hodnoty.')
      return
    }
    setFormError('')
    const onError = () => setFormError('Jedlo sa nepodarilo uložiť. Skontroluj pripojenie a skús to znova.')
    if (isEdit) {
      updateMeal.mutate({
        logId,
        mealName: mealName.trim(),
        mealType,
        loggedAt,
        foods,
        notes: notes.trim() || undefined,
        photoFile,
        removePhoto: removeExistingPhoto,
        existingImageUrl: existingLog?.image_url ?? null,
      }, {
        onSuccess: result => notify(result.photoError ? 'Jedlo sa uložilo, ale fotografiu sa nepodarilo pripojiť.' : 'Zmeny boli uložené.', result.photoError ? 'error' : 'success'),
        onError,
      })
      return
    }
    logMeal.mutate({
      mealName: mealName.trim(), mealType, loggedAt, foods,
      notes: notes.trim() || undefined, photoFile,
    }, {
      onSuccess: result => notify(result.photoError ? 'Jedlo sa uložilo, ale fotografiu sa nepodarilo pripojiť.' : 'Jedlo bolo uložené.', result.photoError ? 'error' : 'success'),
      onError,
    })
  }

  const totals = mealDraftTotals(items.filter(item => item.name.trim()))
  const hasIngredient = items.some(item => item.name.trim())
  const hasAiItems = items.some(item => item.source === 'ai')
  const isPrefilling = (isEdit && mealLogQuery.isLoading) || (recipeId && recipeQuery.isLoading) || (mealId && mealPlanQuery.isLoading)
  const unsavedChangesDialog = (
    <ConfirmDialog
      open={blocked}
      title="Zahodiť neuložené zmeny?"
      description="Máš rozpracované zmeny, ktoré sa neuložili. Ak odídeš, prídeš o ne."
      confirmLabel="Odísť"
      cancelLabel="Zostať"
      confirmVariant="danger"
      onConfirm={confirmLeave}
      onClose={cancelLeave}
      locale="sk"
    />
  )

  if (isEdit && !mealLogQuery.isLoading && !existingLog) {
    return <EmptyState title="Záznam sa nenašiel" message="Toto jedlo už bolo pravdepodobne vymazané." action={<Button onClick={() => navigate('/nutrition/history')}>Späť do histórie</Button>} />
  }

  if (step === 'capture') {
    const captureShortcuts = [
      ...favorites.slice(0, 4).map(favorite => ({
        key: `favorite-${favorite.id}`,
        label: favorite.name,
        detail: `${Math.round(favorite.calories)} kcal`,
        onSelect: () => addDraft(snapshotToDraft(favorite, 'favorite')),
      })),
      ...(recentsQuery.data ?? []).slice(0, 4).map(recent => ({
        key: `recent-${recent.key}`,
        label: recent.name,
        detail: `${Math.round(recent.calories)} kcal`,
        onSelect: () => addDraft(draftFromFood(persistedFood(recent), 'recent')),
      })),
    ]
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 pb-8">
        <div>
          <p className="flex items-center gap-2 ledger-label text-text-secondary">
            <span className="h-3.5 w-[3px] shrink-0 rounded-full bg-accent-strong" aria-hidden="true" />
            Záznam stravy
          </p>
          <h1 ref={captureHeadingRef} tabIndex={-1} className="mt-1 text-3xl font-display font-bold tracking-tight text-text-primary outline-none">Zapísať jedlo</h1>
          <p className="mt-2 text-sm text-text-secondary">Odfoť jedlo a AI ti predvyplní položky. Pred uložením ich skontroluješ.</p>
        </div>

        <Card className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="font-bold text-text-primary">Fotografia jedla</h2><p className="mt-1 text-xs text-text-secondary">Najrýchlejší spôsob. AI z fotografie navrhne položky za teba.</p></div>
            {photoPreview && <button type="button" onClick={clearPhoto} className="rounded-lg p-2 text-text-secondary hover:bg-surface-highest hover:text-error" aria-label="Odstrániť fotografiu"><X size={16} /></button>}
          </div>
          <button type="button" onClick={() => photoInput.current?.click()} className="flex min-h-40 w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-dashed border-outline bg-surface text-sm font-semibold text-text-secondary hover:border-accent hover:text-text-primary">
            {photoPreview ? <img src={photoPreview} alt="Náhľad jedla" className="h-56 w-full object-cover" /> : <><ImagePlus size={30} aria-hidden="true" /><span>{processingPhoto ? 'Pripravujem fotografiu…' : 'Odfotiť alebo nahrať jedlo'}</span></>}
          </button>
          <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void selectPhoto(file); event.target.value = '' }} />
          <textarea value={aiDescription} onChange={event => setAiDescription(event.target.value)} maxLength={500} aria-label="Opis jedla (voliteľné)" placeholder="Voliteľný opis, napr. vyprážané, cca 200 g ryže" className="min-h-20 w-full resize-y rounded-xl border border-outline bg-surface px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary focus:border-accent" />
          <Button className="w-full" loading={analyzing} disabled={!photoFile || processingPhoto} onClick={analyzePhoto}><Sparkles size={16} aria-hidden="true" /> Analyzovať fotografiu</Button>
          <p className="text-xs text-text-secondary">AI iba predvyplní návrh. Výsledok môže byť nepresný.</p>
          <p className="text-xs leading-5 text-text-secondary">Použitím analýzy odošleš pripravenú fotografiu a opis službe Google Gemini. Skontroluj každý odhad pred uložením.</p>
          {photoError && <p role="alert" className="text-xs text-error">{photoError}</p>}
        </Card>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-outline-subtle" />
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">alebo</span>
          <span className="h-px flex-1 bg-outline-subtle" />
        </div>

        <Button variant="secondary" className="w-full" onClick={() => setStep('review')}>Zapísať manuálne</Button>

        {captureShortcuts.length > 0 && (
          <Card className="flex flex-col gap-2 p-4 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Rýchle pridanie</p>
            <div className="divide-y divide-outline-subtle">
              {captureShortcuts.map(shortcut => <QuickAddButton key={shortcut.key} label={shortcut.label} detail={shortcut.detail} onClick={() => { shortcut.onSelect(); setStep('review') }} />)}
            </div>
          </Card>
        )}
        {unsavedChangesDialog}
      </div>
    )
  }

  return (
    // pb accounts for the fixed save bar (~4.3rem) sitting on the fixed athlete
    // bottom nav (~3.5rem baseline + safe-area-inset-bottom on notched devices) so the
    // last field can scroll fully clear of both; cleared at md, where the nav
    // (AthleteAppShell.tsx, md:hidden) and this bar (below) both return to flow.
    <div className="flex flex-col gap-6 pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-8">
      <div>
        {cameFromCapture && <button type="button" onClick={() => setStep('capture')} className="mb-3 inline-flex min-h-8 items-center gap-1 text-sm font-semibold text-text-secondary hover:text-text-primary">← Späť na fotografiu</button>}
        <p className="flex items-center gap-2 ledger-label text-text-secondary">
          <span className="h-3.5 w-[3px] shrink-0 rounded-full bg-accent-strong" aria-hidden="true" />
          Záznam stravy
        </p>
        <h1 ref={reviewHeadingRef} tabIndex={-1} className="mt-1 text-3xl font-display font-bold tracking-tight text-text-primary outline-none">{isEdit ? 'Upraviť jedlo' : 'Zapísať jedlo'}</h1>
        <p className="mt-2 text-sm text-text-secondary">Skontroluj a uprav položky. Nič sa neuloží bez potvrdenia.</p>
      </div>

      {isPrefilling ? <Shimmer className="h-40 w-full" /> : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            <Card className="flex flex-col gap-5 p-5 sm:p-6">
              <Input id="mealName" label="Názov jedla" placeholder="napr. Obed" value={mealName} onChange={event => { setMealName(event.target.value); markDirty() }} />
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Typ jedla
                  <select value={mealType} onChange={event => { setMealType(event.target.value as MealType); markDirty() }} className="h-10 rounded-xl border border-outline bg-surface px-3 text-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent">
                    {MEAL_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <Input label="Dátum" type="date" value={logDate} onChange={event => { setLogDate(event.target.value); markDirty() }} />
                <Input label="Čas" type="time" value={logTime} onChange={event => { setLogTime(event.target.value); markDirty() }} />
              </div>
              {recipeId && recipeQuery.data && (
                <Input label="Počet zjedených porcií" type="number" inputMode="decimal" min={0.1} step={0.1} value={recipeServings} onChange={event => {
                  const servings = Number(event.target.value)
                  setRecipeServings(servings)
                  replaceItems(recipeIngredientsToDrafts(recipeQuery.data as RecipeRow, servings))
                  markDirty()
                }} />
              )}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="mealNotes" className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Poznámka</label>
                  <span className="text-[11px] text-text-secondary">voliteľné</span>
                </div>
                <textarea id="mealNotes" value={notes} onChange={event => { setNotes(event.target.value); markDirty() }} placeholder="Ako jedlo chutilo, úpravy porcie…" className="min-h-20 w-full resize-y rounded-xl border border-outline bg-surface px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary focus:border-accent" />
              </div>
            </Card>

            <Card className="flex flex-col gap-4 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div><h2 className="font-bold text-text-primary">Fotografia a AI odhad</h2><p className="mt-1 text-xs text-text-secondary">{hasAiItems ? 'AI odhad — skontroluj položky' : 'AI iba predvyplní návrh. Výsledok môže byť nepresný.'}</p></div>
                {photoPreview && <button type="button" onClick={clearPhoto} className="rounded-lg p-2 text-text-secondary hover:bg-surface-highest hover:text-error" aria-label="Odstrániť fotografiu"><X size={16} /></button>}
              </div>
              <button type="button" onClick={() => photoInput.current?.click()} className="flex min-h-28 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl border border-dashed border-outline bg-surface text-sm font-semibold text-text-secondary hover:border-accent hover:text-text-primary">
                {photoPreview ? <img src={photoPreview} alt="Náhľad jedla" className="h-48 w-full object-cover" /> : <><ImagePlus size={24} aria-hidden="true" /><span>{processingPhoto ? 'Pripravujem fotografiu…' : 'Pridať fotografiu'}</span></>}
              </button>
              <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void selectPhoto(file); event.target.value = '' }} />
              {photoFile && <textarea value={aiDescription} onChange={event => setAiDescription(event.target.value)} maxLength={500} aria-label="Opis jedla (voliteľné)" placeholder="Voliteľný opis, napr. vyprážané, cca 200 g ryže" className="min-h-20 w-full resize-y rounded-xl border border-outline bg-surface px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary focus:border-accent" />}
              {photoFile && <Button variant="secondary" className="w-full" loading={analyzing} onClick={analyzePhoto}><Sparkles size={16} aria-hidden="true" /> Analyzovať fotografiu</Button>}
              {photoFile && <p className="text-xs leading-5 text-text-secondary">Použitím analýzy odošleš pripravenú fotografiu a opis službe Google Gemini. Skontroluj každý odhad pred uložením.</p>}
              {photoError && <p role="alert" className="text-xs text-error">{photoError}</p>}
            </Card>

            <Card className="p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([['Kcal', totals.calories, ''], ['Bielk.', totals.protein_g, 'g'], ['Sach.', totals.carbs_g, 'g'], ['Tuky', totals.fat_g, 'g']] as const).map(([label, value, unit]) => (
                  <div key={label} className="rounded-xl bg-surface-highest p-3 text-center"><p className="font-display text-lg font-extrabold tabular-nums text-text-primary">{Math.round(value)}{unit}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">{label}</p></div>
                ))}
              </div>
            </Card>

            <section className="flex flex-col gap-3">
              <div className="flex items-end justify-between gap-3"><div><h2 className="font-bold text-text-primary">Položky jedla</h2><p className="mt-1 text-xs text-text-secondary">Rozbaľ položku a uprav gramy alebo makrá.</p></div><span className="text-xs text-text-secondary">{items.filter(item => item.name.trim()).length} položiek</span></div>
              {items.map((item, index) => {
                const expanded = expandedKeys.has(item.key)
                const editorId = `meal-item-editor-${item.key}`
                const lowConfidence = item.source === 'ai' && (item.confidence ?? 1) < 0.7
                const favorite = favoriteForDraft(favorites, item)
                return (
                  <Card key={item.key} className={`p-4 sm:p-5 ${lowConfidence ? 'border-warning/40 bg-warning/5' : ''}`}>
                    <div className="flex items-center gap-2">
                      <button type="button" aria-expanded={expanded} aria-controls={editorId} onClick={() => setExpandedKeys(current => { const next = new Set(current); if (next.has(item.key)) next.delete(item.key); else next.add(item.key); return next })} className="flex min-h-10 min-w-0 flex-1 items-center gap-3 text-left">
                        {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-text-primary">{item.name.trim() || `Nová položka ${index + 1}`}</span><span className="block text-xs text-text-secondary">{item.amount == null ? '' : `${Math.round(item.amount * 10) / 10} ${item.unit ?? ''} · `}{Math.round(item.calories)} kcal</span></span>
                        {lowConfidence && <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-warning"><AlertTriangle size={12} /> nízka istota</span>}
                      </button>
                      <button type="button" aria-label={favorite ? `Odstrániť ${item.name} z obľúbených` : `Pridať ${item.name || 'položku'} medzi obľúbené`} onClick={() => void toggleFavorite(item)} className={`rounded-lg p-2 hover:bg-surface-highest ${favorite ? 'text-warning' : 'text-text-secondary'}`}><Star size={17} fill={favorite ? 'currentColor' : 'none'} /></button>
                      <button type="button" aria-label={`Odstrániť položku ${index + 1}`} onClick={() => removeItem(index)} className="rounded-lg p-2 text-text-secondary hover:bg-surface-highest hover:text-error"><X size={16} /></button>
                    </div>
                    {expanded && <div id={editorId} className="mt-4">
                      {lowConfidence && <p className="mb-3 text-xs leading-5 text-warning">Táto položka je len neistý AI odhad, napríklad skrytý olej alebo cukor. Skontroluj ju alebo odstráň.</p>}
                      <div className="grid gap-3 sm:grid-cols-2"><div className="sm:col-span-2"><Input label="Názov" value={item.name} onChange={event => updateItem(index, draft => ({ ...draft, name: event.target.value }))} placeholder="napr. Ryža" /></div><Input label="Množstvo (voliteľné)" type="number" inputMode="decimal" min={0} step="any" value={item.amount ?? ''} onChange={event => updateItem(index, draft => rescaleDraftAmount(draft, event.target.value === '' ? null : Number(event.target.value)))} /><Input label="Jednotka" value={item.unit ?? ''} disabled={item.amount == null} onChange={event => updateItem(index, draft => ({ ...draft, unit: event.target.value }))} placeholder="g, ml, ks…" /></div>
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{([['calories', 'Kcal'], ['protein_g', 'Bielkoviny'], ['carbs_g', 'Sacharidy'], ['fat_g', 'Tuky']] as const).map(([field, label]) => <Input key={field} label={label} type="number" inputMode="decimal" min={0} step="any" value={item[field]} onChange={event => updateItem(index, draft => updateDraftMacro(draft, field as MacroField, Number(event.target.value)))} />)}</div>
                    </div>}
                  </Card>
                )
              })}
              <Button variant="ghost" className="w-full" onClick={appendManualDraft}><Plus size={17} aria-hidden="true" /> Pridať vlastnú položku</Button>
            </section>

            {formError && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{formError}</p>}
            {/*
              Sits fixed above the athlete bottom nav (AthleteAppShell.tsx), not at
              bottom-0, so the fixed nav (z-30, also bottom-0) can no longer paint over
              it and steal taps on the primary save action. The offset is the nav's own
              rendered height: NavLink py-2 (0.5rem top + bottom) + a 20px icon + gap-1
              (0.25rem) + a text-[10px] label (line-height 1.5 → 15px, from Tailwind's
              preflight `html { line-height: 1.5 }`) + the nav's 1px border-t ≈ 56px
              baseline (3.5rem), rounded up to 4rem for cross-browser buffer, plus
              env(safe-area-inset-bottom) for the home-indicator inset the nav itself
              also pads for. Breakpoint matches the nav's md:hidden (not the previous
              sm:static) so the 640-767px band — where the old mismatch left the bar
              fixed under an also-fixed nav — is covered too.
            */}
            <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-outline bg-background/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
              <Button className="min-h-11 w-full md:ml-auto md:w-auto" loading={logMeal.isPending || updateMeal.isPending} disabled={!mealName.trim() || !hasIngredient || processingPhoto || analyzing} onClick={save}><Camera size={17} aria-hidden="true" /> {isEdit ? 'Uložiť zmeny' : 'Uložiť jedlo'}</Button>
            </div>
          </div>

          <Card className="flex min-w-0 flex-col gap-5 p-5 sm:p-6 lg:sticky lg:top-0">
            <div><h2 className="font-bold text-text-primary">Rýchle pridanie</h2><p className="mt-1 text-xs text-text-secondary">Výber iba doplní návrh. Uloženie zostáva samostatný krok.</p></div>
            <div>
              <label htmlFor="foodSearchInput" className="mb-2 block text-xs font-bold uppercase tracking-wider text-text-secondary">Hľadať potravinu</label>
              <input
                id="foodSearchInput"
                type="text"
                value={foodSearchTerm}
                onChange={event => setFoodSearchTerm(event.target.value)}
                placeholder="Zadaj názov potraviny…"
                className="min-h-11 w-full rounded-xl border border-outline bg-surface px-3 text-sm text-text-primary outline-none placeholder:text-text-secondary focus:border-accent"
              />
              {debouncedFoodSearchTerm.trim().length >= 2 && (
                <div className="mt-2">
                  {foodSearch.isLoading ? (
                    <Shimmer className="h-12 w-full" />
                  ) : foodSearch.isError ? (
                    <p className="text-xs text-error">Potraviny sa nepodarilo načítať.</p>
                  ) : (foodSearch.data ?? []).length === 0 ? (
                    <p className="text-xs text-text-secondary">Žiadna potravina nezodpovedá hľadaniu.</p>
                  ) : (
                    <div className="divide-y divide-outline-subtle">
                      {foodSearch.data!.map((food: FoodRow) => (
                        <QuickAddButton key={food.id} label={food.name} detail={`${Math.round(food.calories)} kcal`} onClick={() => addDraft(draftFromFood(scaleFood(food, food.serving_size), 'manual'))} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            {favorites.length > 0 && <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-text-secondary">Obľúbené</p><div className="divide-y divide-outline-subtle">{favorites.slice(0, 8).map(favorite => <QuickAddButton key={favorite.id} label={favorite.name} detail={`${Math.round(favorite.calories)} kcal`} onClick={() => addDraft(snapshotToDraft(favorite, 'favorite'))} />)}</div></div>}
            {(recentsQuery.data ?? []).length > 0 && <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-text-secondary">Naposledy použité</p><div className="divide-y divide-outline-subtle">{recentsQuery.data!.slice(0, 8).map(recent => <QuickAddButton key={recent.key} label={recent.name} detail={`${Math.round(recent.calories)} kcal`} onClick={() => addDraft(draftFromFood(persistedFood(recent), 'recent'))} />)}</div></div>}
            {(savedMealsQuery.data ?? []).length > 0 && <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-text-secondary">Vlastné jedlá</p><div className="divide-y divide-outline-subtle">{savedMealsQuery.data!.map(saved => <div key={saved.id} className="flex items-center gap-1"><QuickAddButton label={saved.name} detail={`${saved.saved_meal_items.length} položiek`} onClick={() => { setMealName(saved.name); replaceItems(saved.saved_meal_items.map(item => snapshotToDraft(item, 'saved'))); markDirty() }} /><button type="button" aria-label={`Vymazať uložené jedlo ${saved.name}`} onClick={() => void deleteSavedMeal(saved.id)} className="rounded-lg p-2 text-text-secondary hover:bg-surface-highest hover:text-error"><Trash2 size={15} /></button></div>)}</div></div>}
            {(seedFoodsQuery.data ?? []).length > 0 && <details><summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-text-secondary">Základné návrhy</summary><div className="mt-2 divide-y divide-outline-subtle">{seedFoodsQuery.data!.slice(0, 10).map((food: FoodRow) => <QuickAddButton key={food.id} label={food.name} detail={`${Math.round(food.calories)} kcal`} onClick={() => addDraft(draftFromFood(scaleFood(food, food.serving_size), 'manual'))} />)}</div></details>}
            <div className="border-t border-outline-subtle pt-4"><p className="mb-2 text-xs font-bold uppercase tracking-wider text-text-secondary">Uložiť aktuálnu kombináciu</p><div className="flex gap-2"><Input aria-label="Názov vlastného jedla" placeholder="napr. Moje raňajky" value={savedMealName} onChange={event => setSavedMealName(event.target.value)} /><Button variant="secondary" disabled={!savedMealName.trim() || !hasIngredient} loading={saveMealTemplate.isPending} onClick={saveCurrentMealTemplate}>Uložiť</Button></div></div>
          </Card>
        </div>
      )}
      {unsavedChangesDialog}
    </div>
  )
}
