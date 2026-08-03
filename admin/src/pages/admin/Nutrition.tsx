import { useDeferredValue, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, Star, Trash2 } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Chip, ConfirmDialog, DataTable, EmptyState, PageHeader, SearchInput, useNotice } from '../../components/ui'
import type { ActionMenuItem, BulkAction, DataColumn } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import type { Food, MealPlan, Recipe } from '../../types/database'
import RecipeImportModal from './RecipeImportModal'
import RecipePhotoUploadModal from './RecipePhotoUploadModal'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

function useFoods(search: string, page: number, pageSize: number) {
  return useQuery<{ data: Food[]; count: number }>({
    queryKey: ['foods-admin', search, page, pageSize],
    queryFn: async () => {
      let query = supabase
        .from('foods')
        .select('*', { count: 'exact' })
        .order('name')
        .order('id')
        .range(page * pageSize, page * pageSize + pageSize - 1)
      if (search) query = query.ilike('name', `%${search}%`)
      const { data, count, error } = await query
      if (error) throw error
      return { data: data ?? [], count: count ?? 0 }
    },
  })
}

function FoodsTab() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify } = useNotice()
  const [search, setSearch] = useState('')
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null)
  const [deleting, setDeleting] = useState(false)
  const deferredSearch = useDeferredValue(search.trim())
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const { data: { data: foods = [], count: totalCount = 0 } = {}, isLoading, isError } = useFoods(deferredSearch, page, pageSize)

  const deleteFood = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('foods').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foods-admin'] })
    },
  })

  const deleteTargets = deleteIds ? foods.filter(food => deleteIds.includes(food.id)) : []

  async function confirmDelete() {
    if (!deleteIds) return
    setDeleting(true)
    try {
      await Promise.all(deleteIds.map(id => deleteFood.mutateAsync(id)))
      notify(deleteIds.length > 1 ? `${deleteIds.length} foods deleted.` : 'Food deleted.')
      setDeleteIds(null)
    } catch (error) {
      notify(`Couldn’t delete food${deleteIds.length > 1 ? 's' : ''}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const columns: DataColumn<Food>[] = [
    {
      key: 'food',
      header: 'Food',
      render: food => (
        <>
          <p className="font-semibold text-text-primary">{food.name}</p>
          <p className="text-xs text-text-secondary">{food.brand ?? 'No brand'}</p>
        </>
      ),
    },
    { key: 'serving', header: 'Serving', render: food => <>{food.serving_size}{food.serving_unit}</> },
    { key: 'calories', header: 'Calories', render: food => <>{Math.round(food.calories)} kcal</> },
    { key: 'macros', header: 'Macros', render: food => <span className="whitespace-nowrap">P {food.protein_g}g · C {food.carbs_g}g · F {food.fat_g}g</span> },
    {
      key: 'quality',
      header: 'Quality',
      render: food => (food.is_verified ? <span className="text-xs font-semibold text-success">Verified</span> : <span className="text-xs text-text-secondary">Unverified</span>),
    },
  ]

  const rowActions = (food: Food): ActionMenuItem[] => [
    { key: 'open', label: 'Open', onSelect: () => navigate(`/admin/nutrition/foods/${food.id}`) },
    { key: 'delete', label: 'Delete', variant: 'danger', icon: <Trash2 size={16} />, onSelect: () => setDeleteIds([food.id]) },
  ]

  const bulkActions = (selected: Food[]): BulkAction[] => [
    { key: 'delete', label: 'Delete', variant: 'danger', icon: <Trash2 size={16} />, onClick: () => setDeleteIds(selected.map(food => food.id)) },
  ]

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchInput placeholder="Search foods…" value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} onClear={() => { setSearch(''); setPage(0) }} className="w-full sm:w-72" />
        <Button onClick={() => navigate('/admin/nutrition/foods/new')}>Add food</Button>
      </div>

      {isError ? (
        <EmptyState title="Foods couldn’t be loaded" description="Refresh the page to retry." />
      ) : (
        <DataTable<Food>
          rows={foods}
          getRowId={food => food.id}
          columns={columns}
          rowLabel={food => `Open ${food.name}`}
          onRowActivate={food => navigate(`/admin/nutrition/foods/${food.id}`)}
          rowActions={rowActions}
          selectable
          bulkActions={bulkActions}
          serverPagination
          page={page}
          pageSize={pageSize}
          totalItems={totalCount}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={setPage}
          onPageSizeChange={size => { setPageSize(size); setPage(0) }}
          loading={isLoading}
          empty={
            <EmptyState
              title={search ? 'No foods match this search' : 'No foods in the library yet'}
              description={search ? 'Try a different food or brand.' : 'Add a verified food to make it available to athletes.'}
              action={!search ? <Button onClick={() => navigate('/admin/nutrition/foods/new')}>Add food</Button> : undefined}
            />
          }
        />
      )}

      <ConfirmDialog
        open={deleteIds !== null}
        title={deleteIds && deleteIds.length > 1 ? `Delete ${deleteIds.length} foods?` : 'Delete food?'}
        description={
          deleteIds && deleteIds.length > 1 ? (
            <>{deleteIds.length} foods will be permanently removed from the food library.</>
          ) : deleteTargets[0] ? (
            <>“{deleteTargets[0].name}” will be permanently removed from the food library.</>
          ) : (
            <>This food will be permanently removed from the food library.</>
          )
        }
        pending={deleting}
        onClose={() => setDeleteIds(null)}
        onConfirm={confirmDelete}
      />
    </>
  )
}

function useRecipes(search: string, generatorOnly: boolean, page: number, pageSize: number) {
  return useQuery<{ data: Recipe[]; count: number }>({
    queryKey: ['recipes-admin', search, generatorOnly, page, pageSize],
    queryFn: async () => {
      let query = supabase
        .from('recipes')
        .select('*', { count: 'exact' })
        .order('name')
        .order('id')
        .range(page * pageSize, page * pageSize + pageSize - 1)
      if (search) query = query.ilike('name', `%${search}%`)
      if (generatorOnly) query = query.eq('eligible_for_generator', true).eq('macros_verified', true)
      const { data, count, error } = await query
      if (error) throw error
      return { data: data ?? [], count: count ?? 0 }
    },
  })
}

function RecipesTab() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify } = useNotice()
  const [search, setSearch] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [photoUploadOpen, setPhotoUploadOpen] = useState(false)
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [generatorOnly, setGeneratorOnly] = useState(false)
  const deferredSearch = useDeferredValue(search.trim())
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const { data: { data: recipes = [], count: totalCount = 0 } = {}, isLoading, isError } = useRecipes(deferredSearch, generatorOnly, page, pageSize)

  const updateRecipe = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<Recipe, 'featured' | 'is_active'>>; silent?: boolean }) => {
      const { data, error } = await supabase.from('recipes').update(patch).eq('id', id).select('id').maybeSingle()
      if (error) throw error
      if (!data) throw new Error('No recipe was updated')
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipes-admin'] })
      if (!variables.silent) notify('is_active' in variables.patch ? (variables.patch.is_active ? 'Recipe restored.' : 'Recipe archived.') : 'Featured recipe updated.')
    },
    onError: (error, variables) => { if (!variables.silent) notify(`Couldn’t update recipe: ${error.message}`, 'error') },
  })

  const deleteRecipe = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('recipes').delete().eq('id', id).select('id').maybeSingle()
      if (error) throw error
      if (!data) throw new Error('No recipe was deleted')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes-admin'] })
    },
  })

  const deleteTargets = deleteIds ? recipes.filter(recipe => deleteIds.includes(recipe.id)) : []

  async function confirmDelete() {
    if (!deleteIds) return
    setDeleting(true)
    try {
      await Promise.all(deleteIds.map(id => deleteRecipe.mutateAsync(id)))
      notify(deleteIds.length > 1 ? `${deleteIds.length} recipes deleted.` : 'Recipe deleted.')
      setDeleteIds(null)
    } catch (error) {
      notify(`Couldn’t delete recipe${deleteIds.length > 1 ? 's' : ''}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const columns: DataColumn<Recipe>[] = [
    {
      key: 'recipe',
      header: 'Recipe',
      render: recipe => (
        <div className="flex min-w-64 items-center gap-3">
          {recipe.photo_url ? <img src={recipe.photo_url} alt="" className="h-12 w-16 flex-shrink-0 rounded-xl object-cover" /> : <div className="h-12 w-16 flex-shrink-0 rounded-xl bg-surface-highest" />}
          <div className="min-w-0"><p className="truncate font-semibold text-text-primary">{recipe.name}</p><p className="truncate text-xs text-text-secondary">{recipe.tags?.slice(0, 3).join(' · ') || 'No tags'}</p></div>
        </div>
      ),
    },
    { key: 'difficulty', header: 'Difficulty', className: 'capitalize', render: recipe => recipe.difficulty ?? '—' },
    { key: 'macros', header: 'Macros', render: recipe => <span className="whitespace-nowrap">{Math.round(recipe.calories)} kcal · P {recipe.protein_g.toFixed(0)}g</span> },
    {
      key: 'status',
      header: 'Status',
      render: recipe => (
        <>
          {recipe.is_active ? <span className="text-xs font-semibold text-success">Active</span> : <span className="text-xs text-text-secondary">Archived</span>}
          {recipe.eligible_for_generator && recipe.macros_verified && (
            <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">Generator</span>
          )}
        </>
      ),
    },
    {
      key: 'featured',
      header: 'Featured',
      render: recipe => (
        <button
          type="button"
          aria-label={recipe.featured ? `Remove ${recipe.name} from featured recipes` : `Feature ${recipe.name}`}
          onClick={() => updateRecipe.mutate({ id: recipe.id, patch: { featured: !recipe.featured } })}
          className={`flex min-h-10 min-w-10 cursor-pointer items-center justify-center rounded-xl border-0 bg-transparent ${recipe.featured ? 'text-warning' : 'text-text-secondary hover:bg-surface'}`}
        >
          <Star size={17} fill={recipe.featured ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      ),
    },
  ]

  const rowActions = (recipe: Recipe): ActionMenuItem[] => [
    { key: 'open', label: 'Open', onSelect: () => navigate(`/admin/nutrition/recipes/${recipe.id}`) },
    recipe.is_active
      ? { key: 'archive', label: 'Archive', icon: <Archive size={16} />, onSelect: () => updateRecipe.mutate({ id: recipe.id, patch: { is_active: false } }) }
      : { key: 'restore', label: 'Restore', icon: <ArchiveRestore size={16} />, onSelect: () => updateRecipe.mutate({ id: recipe.id, patch: { is_active: true } }) },
    { key: 'delete', label: 'Delete', variant: 'danger', icon: <Trash2 size={16} />, onSelect: () => setDeleteIds([recipe.id]) },
  ]

  const bulkActions = (selected: Recipe[]): BulkAction[] => [
    {
      key: 'archive',
      label: 'Archive',
      icon: <Archive size={16} />,
      disabled: bulkBusy,
      onClick: async () => {
        setBulkBusy(true)
        try {
          await Promise.all(selected.map(recipe => updateRecipe.mutateAsync({ id: recipe.id, patch: { is_active: false }, silent: true })))
          notify('Recipes archived.')
        } catch (error) {
          notify(`Couldn’t archive recipes: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
        } finally {
          setBulkBusy(false)
        }
      },
    },
    { key: 'delete', label: 'Delete', variant: 'danger', icon: <Trash2 size={16} />, onClick: () => setDeleteIds(selected.map(recipe => recipe.id)) },
  ]

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchInput placeholder="Search recipes…" value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} onClear={() => { setSearch(''); setPage(0) }} className="w-full sm:w-72" />
        <Chip selected={generatorOnly} onClick={() => { setGeneratorOnly(current => !current); setPage(0) }}>
          Generator-ready only
        </Chip>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setPhotoUploadOpen(true)}>Upload photos</Button>
          <Button variant="ghost" onClick={() => setImportOpen(true)}>Import JSON</Button>
          <Button onClick={() => navigate('/admin/nutrition/recipes/new')}>Add recipe</Button>
        </div>
      </div>

      {isError ? (
        <EmptyState title="Recipes couldn’t be loaded" description="Refresh the page to retry." />
      ) : (
        <DataTable<Recipe>
          rows={recipes}
          getRowId={recipe => recipe.id}
          columns={columns}
          rowLabel={recipe => `Open ${recipe.name}`}
          onRowActivate={recipe => navigate(`/admin/nutrition/recipes/${recipe.id}`)}
          rowActions={rowActions}
          selectable
          bulkActions={bulkActions}
          serverPagination
          page={page}
          pageSize={pageSize}
          totalItems={totalCount}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={setPage}
          onPageSizeChange={size => { setPageSize(size); setPage(0) }}
          loading={isLoading}
          empty={
            search || generatorOnly ? (
              <EmptyState
                title="No recipes match the current filter"
                description={generatorOnly ? 'Try a different search or turn off the generator-ready filter.' : 'Try a different recipe name.'}
              />
            ) : (
              <EmptyState
                title="No recipes in the library yet"
                description="Add your first reusable recipe or import a recipe file."
                action={<Button onClick={() => navigate('/admin/nutrition/recipes/new')}>Add recipe</Button>}
              />
            )
          }
        />
      )}

      <RecipeImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <RecipePhotoUploadModal open={photoUploadOpen} onClose={() => setPhotoUploadOpen(false)} />
      <ConfirmDialog
        open={deleteIds !== null}
        title={deleteIds && deleteIds.length > 1 ? `Delete ${deleteIds.length} recipes permanently?` : 'Delete recipe permanently?'}
        description={
          deleteIds && deleteIds.length > 1 ? (
            <>{deleteIds.length} recipes will be removed from the library. Historical meal-plan entries keep their saved nutrition snapshot.</>
          ) : deleteTargets[0] ? (
            <>“{deleteTargets[0].name}” will be removed from the library. Historical meal-plan entries keep their saved nutrition snapshot.</>
          ) : (
            <>This recipe will be removed from the library. Historical meal-plan entries keep their saved nutrition snapshot.</>
          )
        }
        pending={deleting}
        onClose={() => setDeleteIds(null)}
        onConfirm={confirmDelete}
      />
    </>
  )
}

function useMealPlans(originFilter: 'all' | 'manual' | 'generated', page: number, pageSize: number) {
  return useQuery<{ data: MealPlan[]; count: number }>({
    queryKey: ['meal-plans-admin', originFilter, page, pageSize],
    queryFn: async () => {
      let query = supabase
        .from('meal_plans')
        .select('*', { count: 'exact' })
        .order('name')
        .order('id')
        .range(page * pageSize, page * pageSize + pageSize - 1)
      if (originFilter === 'generated') query = query.eq('origin', 'generated')
      if (originFilter === 'manual') query = query.or('origin.eq.manual,origin.is.null')
      const { data, count, error } = await query
      if (error) throw error
      return { data: data ?? [], count: count ?? 0 }
    },
  })
}

function usePlanAssignmentCounts(planIds: string[]) {
  return useQuery<Record<string, number>>({
    queryKey: ['meal-plan-assignment-counts', planIds],
    queryFn: async () => {
      if (!planIds.length) return {}
      const { data, error } = await supabase.from('user_meal_plans').select('meal_plan_id').eq('status', 'current').in('meal_plan_id', planIds)
      if (error) throw error
      return (data ?? []).reduce<Record<string, number>>((counts, row) => {
        counts[row.meal_plan_id] = (counts[row.meal_plan_id] ?? 0) + 1
        return counts
      }, {})
    },
  })
}

function MealPlansTab() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify } = useNotice()
  const [deleteTargets, setDeleteTargets] = useState<MealPlan[] | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [originFilter, setOriginFilter] = useState<'all' | 'manual' | 'generated'>('all')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const { data: { data: mealPlans = [], count: totalCount = 0 } = {}, isLoading, isError } = useMealPlans(originFilter, page, pageSize)
  const { data: assignmentCounts = {} } = usePlanAssignmentCounts(mealPlans.map(plan => plan.id))

  const planRoute = (plan: MealPlan) =>
    plan.origin === 'generated' ? `/admin/nutrition/meal-plans/${plan.id}/preview` : `/admin/nutrition/meal-plans/${plan.id}`

  const deletePlan = useMutation({
    mutationFn: async (plan: MealPlan) => {
      if (plan.origin === 'generated') {
        const { data, error } = await supabase.rpc('admin_delete_generated_meal_plan', { p_plan_id: plan.id })
        if (error) throw error
        if (data !== plan.id) throw new Error('No generated meal plan was deleted')
        return
      }

      const { data, error } = await supabase.from('meal_plans').delete().eq('id', plan.id).select('id').maybeSingle()
      if (error) throw error
      if (!data) throw new Error('No meal plan was deleted')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-plans-admin'] })
      queryClient.invalidateQueries({ queryKey: ['meal-plan-assignment-counts'] })
    },
  })

  async function confirmDelete() {
    if (!deleteTargets) return
    setDeleting(true)
    try {
      await Promise.all(deleteTargets.map(plan => deletePlan.mutateAsync(plan)))
      notify(deleteTargets.length > 1 ? `${deleteTargets.length} meal plans deleted.` : 'Meal plan deleted.')
      setDeleteTargets(null)
    } catch (error) {
      notify(`Couldn’t delete meal plan${deleteTargets.length > 1 ? 's' : ''}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const columns: DataColumn<MealPlan>[] = [
    {
      key: 'plan',
      header: 'Plan',
      render: plan => (
        <>
          <p className="font-semibold text-text-primary">{plan.name}</p>
          <p className="max-w-xl truncate text-xs text-text-secondary">{plan.description ?? 'No description'}</p>
        </>
      ),
    },
    { key: 'assigned', header: 'Assigned to', render: plan => <>{assignmentCounts[plan.id] ?? 0} current</> },
    {
      key: 'status',
      header: 'Status',
      render: plan => (
        <>
          {plan.is_active ? <span className="text-xs font-semibold text-success">Active</span> : <span className="text-xs text-text-secondary">Inactive</span>}
          {plan.origin === 'generated' && (
            <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
              Generated{plan.generation_status === 'draft' ? ' · draft' : ''}
            </span>
          )}
        </>
      ),
    },
  ]

  const rowActions = (plan: MealPlan): ActionMenuItem[] => [
    { key: 'open', label: 'Open', onSelect: () => navigate(planRoute(plan)) },
    { key: 'delete', label: 'Delete', variant: 'danger', icon: <Trash2 size={16} />, onSelect: () => setDeleteTargets([plan]) },
  ]

  const bulkActions = (selected: MealPlan[]): BulkAction[] => [
    { key: 'delete', label: 'Delete', variant: 'danger', icon: <Trash2 size={16} />, onClick: () => setDeleteTargets(selected) },
  ]

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-text-secondary">{totalCount} meal plans</p>
          <div className="flex gap-2">
            {(['all', 'manual', 'generated'] as const).map(option => (
              <Chip key={option} selected={originFilter === option} onClick={() => { setOriginFilter(option); setPage(0) }} className="capitalize">{option}</Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate('/admin/nutrition/meal-plans/generate')}>Generate from macro goals</Button>
          <Button onClick={() => navigate('/admin/nutrition/meal-plans/new')}>Create meal plan</Button>
        </div>
      </div>

      {isError ? (
        <EmptyState title="Meal plans couldn’t be loaded" description="Refresh the page to retry." />
      ) : (
        <DataTable<MealPlan>
          rows={mealPlans}
          getRowId={plan => plan.id}
          columns={columns}
          rowLabel={plan => `Open ${plan.name}`}
          onRowActivate={plan => navigate(planRoute(plan))}
          rowActions={rowActions}
          selectable
          bulkActions={bulkActions}
          serverPagination
          page={page}
          pageSize={pageSize}
          totalItems={totalCount}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={setPage}
          onPageSizeChange={size => { setPageSize(size); setPage(0) }}
          loading={isLoading}
          empty={
            originFilter !== 'all' ? (
              <EmptyState title="No meal plans match this filter" description="Try a different origin filter." />
            ) : (
              <EmptyState title="No meal plans yet" description="Create a weekly plan and assign it when it is ready." action={<Button onClick={() => navigate('/admin/nutrition/meal-plans/new')}>Create meal plan</Button>} />
            )
          }
        />
      )}

      <ConfirmDialog
        open={deleteTargets !== null}
        title={deleteTargets && deleteTargets.length > 1 ? `Delete ${deleteTargets.length} meal plans?` : 'Delete meal plan?'}
        description={
          deleteTargets && deleteTargets.length > 1 ? (
            <>{deleteTargets.length} meal plans will be permanently removed.</>
          ) : deleteTargets?.[0] ? (
            <>“{deleteTargets[0].name}” will be permanently removed.</>
          ) : (
            <>This meal plan will be permanently removed.</>
          )
        }
        pending={deleting}
        onClose={() => setDeleteTargets(null)}
        onConfirm={confirmDelete}
      />
    </>
  )
}

export default function Nutrition() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const activeTab: 'recipes' | 'meal-plans' | 'foods' = requestedTab === 'meal-plans' || requestedTab === 'foods' ? requestedTab : 'recipes'

  function selectTab(tab: 'recipes' | 'meal-plans' | 'foods') {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader title="Nutrition" description="Manage athlete-ready recipes, weekly meal plans, and verified foods." />
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {(['recipes', 'meal-plans', 'foods'] as const).map(tab => (
          <Chip key={tab} onClick={() => selectTab(tab)} selected={activeTab === tab} className="capitalize">{tab.replace('-', ' ')}</Chip>
        ))}
      </div>
      {activeTab === 'recipes' && <RecipesTab />}
      {activeTab === 'meal-plans' && <MealPlansTab />}
      {activeTab === 'foods' && <FoodsTab />}
    </div>
  )
}
