import { useDeferredValue, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Chip, ConfirmDialog, EmptyState, PageHeader, SearchInput, Table, Td, Th, useNotice } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import type { Food, MealPlan, Recipe } from '../../types/database'
import RecipeImportModal from './RecipeImportModal'
import RecipePhotoUploadModal from './RecipePhotoUploadModal'

function useFoods(search: string) {
  return useQuery<Food[]>({
    queryKey: ['foods-admin', search],
    queryFn: async () => {
      let query = supabase.from('foods').select('*').order('name')
      if (search) query = query.ilike('name', `%${search}%`)
      const { data, error } = await query
      if (error) throw error
      return data ?? []
    },
  })
}

function FoodsTab() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify } = useNotice()
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Food | null>(null)
  const deferredSearch = useDeferredValue(search)
  const { data: foods = [], isLoading, isError } = useFoods(deferredSearch)

  const deleteFood = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('foods').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foods-admin'] })
      setDeleteTarget(null)
      notify('Food deleted.')
    },
    onError: error => notify(`Couldn’t delete food: ${error.message}`, 'error'),
  })

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchInput placeholder="Search foods…" value={search} onChange={event => setSearch(event.target.value)} onClear={() => setSearch('')} className="w-full sm:w-72" />
        <Button onClick={() => navigate('/admin/nutrition/foods/new')}>Add food</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : isError ? (
        <EmptyState title="Foods couldn’t be loaded" description="Refresh the page to retry." />
      ) : foods.length === 0 ? (
        <EmptyState
          title={search ? 'No foods match this search' : 'No foods in the library yet'}
          description={search ? 'Try a different food or brand.' : 'Add a verified food to make it available to athletes.'}
          action={!search ? <Button onClick={() => navigate('/admin/nutrition/foods/new')}>Add food</Button> : undefined}
        />
      ) : (
        <Table>
          <thead><tr><Th>Food</Th><Th>Serving</Th><Th>Calories</Th><Th>Macros</Th><Th>Quality</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
          <tbody>
            {foods.map(food => (
              <tr key={food.id} className="hover:bg-surface-highest">
                <Td><p className="font-semibold text-text-primary">{food.name}</p><p className="text-xs text-text-secondary">{food.brand ?? 'No brand'}</p></Td>
                <Td>{food.serving_size}{food.serving_unit}</Td>
                <Td>{Math.round(food.calories)} kcal</Td>
                <Td><span className="whitespace-nowrap">P {food.protein_g}g · C {food.carbs_g}g · F {food.fat_g}g</span></Td>
                <Td>{food.is_verified ? <span className="text-xs font-semibold text-success">Verified</span> : <span className="text-xs text-text-secondary">Unverified</span>}</Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" className="min-h-9 px-3" onClick={() => navigate(`/admin/nutrition/foods/${food.id}`)}>Open</Button>
                    <Button variant="danger" className="min-h-9 px-3" onClick={() => setDeleteTarget(food)}>Delete</Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete food?"
        description={<>“{deleteTarget?.name}” will be permanently removed from the food library.</>}
        pending={deleteFood.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteFood.mutate(deleteTarget.id)}
      />
    </>
  )
}

function useRecipes(search: string) {
  return useQuery<Recipe[]>({
    queryKey: ['recipes-admin', search],
    queryFn: async () => {
      let query = supabase.from('recipes').select('*').order('name')
      if (search) query = query.ilike('name', `%${search}%`)
      const { data, error } = await query
      if (error) throw error
      return data ?? []
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
  const deferredSearch = useDeferredValue(search)
  const { data: recipes = [], isLoading, isError } = useRecipes(deferredSearch)

  const updateRecipe = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<Recipe, 'featured' | 'is_active'>> }) => {
      const { data, error } = await supabase.from('recipes').update(patch).eq('id', id).select('id').maybeSingle()
      if (error) throw error
      if (!data) throw new Error('No recipe was updated')
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipes-admin'] })
      notify('is_active' in variables.patch ? (variables.patch.is_active ? 'Recipe restored.' : 'Recipe archived.') : 'Featured recipe updated.')
    },
    onError: error => notify(`Couldn’t update recipe: ${error.message}`, 'error'),
  })

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchInput placeholder="Search recipes…" value={search} onChange={event => setSearch(event.target.value)} onClear={() => setSearch('')} className="w-full sm:w-72" />
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setPhotoUploadOpen(true)}>Upload photos</Button>
          <Button variant="ghost" onClick={() => setImportOpen(true)}>Import JSON</Button>
          <Button onClick={() => navigate('/admin/nutrition/recipes/new')}>Add recipe</Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : isError ? (
        <EmptyState title="Recipes couldn’t be loaded" description="Refresh the page to retry." />
      ) : recipes.length === 0 ? (
        <EmptyState
          title={search ? 'No recipes match this search' : 'No recipes in the library yet'}
          description={search ? 'Try a different recipe name.' : 'Add your first reusable recipe or import a recipe file.'}
          action={!search ? <Button onClick={() => navigate('/admin/nutrition/recipes/new')}>Add recipe</Button> : undefined}
        />
      ) : (
        <Table>
          <thead><tr><Th>Recipe</Th><Th>Difficulty</Th><Th>Macros</Th><Th>Status</Th><Th>Featured</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
          <tbody>
            {recipes.map(recipe => (
              <tr key={recipe.id} className="hover:bg-surface-highest">
                <Td>
                  <div className="flex min-w-64 items-center gap-3">
                    {recipe.photo_url ? <img src={recipe.photo_url} alt="" className="h-12 w-16 flex-shrink-0 rounded-xl object-cover" /> : <div className="h-12 w-16 flex-shrink-0 rounded-xl bg-surface-highest" />}
                    <div className="min-w-0"><p className="truncate font-semibold text-text-primary">{recipe.name}</p><p className="truncate text-xs text-text-secondary">{recipe.tags?.slice(0, 3).join(' · ') || 'No tags'}</p></div>
                  </div>
                </Td>
                <Td className="capitalize">{recipe.difficulty ?? '—'}</Td>
                <Td><span className="whitespace-nowrap">{Math.round(recipe.calories)} kcal · P {recipe.protein_g.toFixed(0)}g</span></Td>
                <Td>{recipe.is_active ? <span className="text-xs font-semibold text-success">Active</span> : <span className="text-xs text-text-secondary">Archived</span>}</Td>
                <Td>
                  <button
                    type="button"
                    aria-label={recipe.featured ? `Remove ${recipe.name} from featured recipes` : `Feature ${recipe.name}`}
                    onClick={() => updateRecipe.mutate({ id: recipe.id, patch: { featured: !recipe.featured } })}
                    className={`flex min-h-10 min-w-10 cursor-pointer items-center justify-center rounded-xl border-0 bg-transparent ${recipe.featured ? 'text-warning' : 'text-text-secondary hover:bg-surface'}`}
                  >
                    <Star size={17} fill={recipe.featured ? 'currentColor' : 'none'} aria-hidden="true" />
                  </button>
                </Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" className="min-h-9 px-3" onClick={() => navigate(`/admin/nutrition/recipes/${recipe.id}`)}>Open</Button>
                    <Button variant={recipe.is_active ? 'danger' : 'secondary'} className="min-h-9 px-3" onClick={() => updateRecipe.mutate({ id: recipe.id, patch: { is_active: !recipe.is_active } })}>
                      {recipe.is_active ? 'Archive' : 'Restore'}
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <RecipeImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <RecipePhotoUploadModal open={photoUploadOpen} onClose={() => setPhotoUploadOpen(false)} />
    </>
  )
}

function useMealPlans() {
  return useQuery<MealPlan[]>({
    queryKey: ['meal-plans-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('meal_plans').select('*').order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

function usePlanAssignmentCounts() {
  return useQuery<Record<string, number>>({
    queryKey: ['meal-plan-assignment-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_meal_plans').select('meal_plan_id').eq('status', 'current')
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
  const { data: mealPlans = [], isLoading, isError } = useMealPlans()
  const { data: assignmentCounts = {} } = usePlanAssignmentCounts()
  const [deleteTarget, setDeleteTarget] = useState<MealPlan | null>(null)

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meal_plans').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-plans-admin'] })
      queryClient.invalidateQueries({ queryKey: ['meal-plan-assignment-counts'] })
      setDeleteTarget(null)
      notify('Meal plan deleted.')
    },
    onError: error => notify(`Couldn’t delete meal plan: ${error.message}`, 'error'),
  })

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">{mealPlans.length} meal plans</p>
        <Button onClick={() => navigate('/admin/nutrition/meal-plans/new')}>Create meal plan</Button>
      </div>
      {isLoading ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : isError ? (
        <EmptyState title="Meal plans couldn’t be loaded" description="Refresh the page to retry." />
      ) : mealPlans.length === 0 ? (
        <EmptyState title="No meal plans yet" description="Create a weekly plan and assign it when it is ready." action={<Button onClick={() => navigate('/admin/nutrition/meal-plans/new')}>Create meal plan</Button>} />
      ) : (
        <Table>
          <thead><tr><Th>Plan</Th><Th>Assigned to</Th><Th>Status</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
          <tbody>
            {mealPlans.map(plan => (
              <tr key={plan.id} className="hover:bg-surface-highest">
                <Td><p className="font-semibold text-text-primary">{plan.name}</p><p className="max-w-xl truncate text-xs text-text-secondary">{plan.description ?? 'No description'}</p></Td>
                <Td>{assignmentCounts[plan.id] ?? 0} current</Td>
                <Td>{plan.is_active ? <span className="text-xs font-semibold text-success">Active</span> : <span className="text-xs text-text-secondary">Inactive</span>}</Td>
                <Td><div className="flex justify-end gap-2"><Button variant="ghost" className="min-h-9 px-3" onClick={() => navigate(`/admin/nutrition/meal-plans/${plan.id}`)}>Open</Button><Button variant="danger" className="min-h-9 px-3" onClick={() => setDeleteTarget(plan)}>Delete</Button></div></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete meal plan?"
        description={<>“{deleteTarget?.name}” will be permanently removed.</>}
        pending={deletePlan.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deletePlan.mutate(deleteTarget.id)}
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
