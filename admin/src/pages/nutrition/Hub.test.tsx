import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Hub from './Hub'
import { useAuth } from '../../hooks/useAuth'
import { getActiveWorkout, getAssignedWorkouts } from '../../activity/api'

vi.mock('@tanstack/react-query', () => ({ useQuery: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../../activity/api', () => ({ getAssignedWorkouts: vi.fn(), getActiveWorkout: vi.fn() }))
vi.mock('./Plan', () => ({ default: () => <div>Embedded meal plan</div> }))
vi.mock('./Recipes', () => ({ default: () => <div>Embedded recipes</div> }))

type QueryResult = { data: unknown; isLoading: boolean }

const DEFAULTS: Record<string, QueryResult> = {
  dailyLogs: { data: [], isLoading: false },
  macroTarget: { data: null, isLoading: false },
  recipes: { data: [], isLoading: false },
  activeQuote: { data: null, isLoading: false },
  mealPlan: { data: null, isLoading: false },
  'activity:assigned': { data: [], isLoading: false },
  'activity:active': { data: null, isLoading: false },
}

// Every hook Hub.tsx touches ultimately calls this mocked `useQuery`, so tests
// drive behaviour by branching on the query key's first (and, for the shared
// `activity` namespace, second) segment rather than mocking each local hook.
//
// For the `activity` namespace specifically, this also invokes the real
// `queryFn` whenever the component passed `enabled !== false` — mirroring
// react-query closely enough that tests can assert `getAssignedWorkouts` /
// `getActiveWorkout` were (not) called, which is the only way to prove the
// workout queries are actually gated rather than just their JSX.
function mockQueries(overrides: Record<string, QueryResult> = {}) {
  const merged = { ...DEFAULTS, ...overrides }
  vi.mocked(useQuery).mockImplementation((options: unknown) => {
    const { queryKey, queryFn, enabled } = options as {
      queryKey: readonly unknown[]
      queryFn?: () => unknown
      enabled?: boolean
    }
    const [type, sub] = queryKey as [string, string?]
    if (type === 'activity' && enabled !== false) queryFn?.()
    const bucket = type === 'activity' ? `activity:${sub}` : type
    return (merged[bucket] ?? { data: undefined, isLoading: false }) as ReturnType<typeof useQuery>
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAuth).mockReturnValue({ user: { id: 'athlete-1' }, profile: null } as unknown as ReturnType<typeof useAuth>)
  mockQueries()
})
afterEach(() => cleanup())

it('keeps today, meal plan, and recipes inside one nutrition hub', async () => {
  render(<MemoryRouter initialEntries={['/nutrition/plan']}><Hub /></MemoryRouter>)
  const user = userEvent.setup()

  expect(screen.getByRole('heading', { name: 'Výživa' })).toBeInTheDocument()
  expect(screen.getByText('Embedded meal plan')).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Sekcie výživy' })).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Nutrition sections' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Jedálniček' })).toHaveAttribute('aria-current', 'page')

  await user.click(screen.getByRole('button', { name: 'Recepty' }))

  expect(screen.getByText('Embedded recipes')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Recepty' })).toHaveAttribute('aria-current', 'page')
})

it('shows the active daily quote and hides it entirely when there is none', () => {
  mockQueries({ activeQuote: { data: { id: 'q1', text: 'Discipline beats motivation.', author: 'Coach K' }, isLoading: false } })
  render(<MemoryRouter initialEntries={['/nutrition']}><Hub /></MemoryRouter>)

  expect(screen.getByText('Discipline beats motivation.')).toBeInTheDocument()
  expect(screen.getByText('— Coach K')).toBeInTheDocument()
  cleanup()

  mockQueries({ activeQuote: { data: null, isLoading: false } })
  render(<MemoryRouter initialEntries={['/nutrition']}><Hub /></MemoryRouter>)

  expect(screen.queryByText('Discipline beats motivation.')).not.toBeInTheDocument()
})

it('lists todays logged meals with kcal totals linking to their detail page', () => {
  mockQueries({
    dailyLogs: {
      data: [
        {
          id: 'log-1', user_id: 'athlete-1', meal_name: 'Raňajky', meal_type: 'breakfast', notes: null,
          image_url: null, logged_at: '2026-08-04T07:15:00Z',
          meal_log_foods: [{ id: 'f1', meal_log_id: 'log-1', name: 'Ovsená kaša', amount: 300, unit: 'g', amount_grams: 300, calories: 420, protein_g: 15, carbs_g: 60, fat_g: 10 }],
        },
        {
          id: 'log-2', user_id: 'athlete-1', meal_name: 'Obed', meal_type: 'lunch', notes: null,
          image_url: null, logged_at: '2026-08-04T12:00:00Z',
          meal_log_foods: [{ id: 'f2', meal_log_id: 'log-2', name: 'Kura s ryžou', amount: 400, unit: 'g', amount_grams: 400, calories: 650, protein_g: 45, carbs_g: 70, fat_g: 12 }],
        },
      ],
      isLoading: false,
    },
  })
  render(<MemoryRouter initialEntries={['/nutrition']}><Hub /></MemoryRouter>)

  expect(screen.getByText('Raňajky')).toBeInTheDocument()
  expect(screen.getByText('420 kcal')).toBeInTheDocument()
  expect(screen.getByText('Obed')).toBeInTheDocument()
  expect(screen.getByText('650 kcal')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Raňajky/ })).toHaveAttribute('href', '/nutrition/history/log-1')
})

it('shows the Dnešné jedlá empty state with a Zapísať jedlo action when the day has no logs', () => {
  mockQueries({ dailyLogs: { data: [], isLoading: false } })
  render(<MemoryRouter initialEntries={['/nutrition']}><Hub /></MemoryRouter>)

  expect(screen.getByText('Dnes si ešte nemáš zapísané žiadne jedlo.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Zapísať jedlo' })).toHaveAttribute('href', '/nutrition/log')
})

it('renders no Dnešný jedálniček section when there is no assigned meal plan', () => {
  mockQueries({ mealPlan: { data: null, isLoading: false } })
  render(<MemoryRouter initialEntries={['/nutrition']}><Hub /></MemoryRouter>)

  expect(screen.queryByText('Dnešný jedálniček')).not.toBeInTheDocument()
})

it('shows Pokračovať (not Začať tréning) when an active workout session exists', () => {
  mockQueries({
    'activity:active': { data: { id: 'log-1', workout_name: 'Push Day', status: 'in_progress' }, isLoading: false },
    'activity:assigned': { data: [{ id: 'w1', name: 'Push Day', workout_exercises: [] }], isLoading: false },
  })
  render(<MemoryRouter initialEntries={['/nutrition']}><Hub /></MemoryRouter>)

  expect(screen.getByRole('link', { name: 'Pokračovať' })).toHaveAttribute('href', '/activity/session')
  expect(screen.queryByRole('link', { name: 'Začať tréning' })).not.toBeInTheDocument()
})

it('hides the workout block and never queries workout data for a nutrition-only athlete, even with an active workout', () => {
  vi.mocked(useAuth).mockReturnValue({ user: { id: 'athlete-1' }, profile: { access_mode: 'nutrition' } } as unknown as ReturnType<typeof useAuth>)
  mockQueries({
    'activity:active': { data: { id: 'log-1', workout_name: 'Push Day', status: 'in_progress' }, isLoading: false },
    'activity:assigned': { data: [{ id: 'w1', name: 'Push Day', workout_exercises: [] }], isLoading: false },
  })
  render(<MemoryRouter initialEntries={['/nutrition']}><Hub /></MemoryRouter>)

  expect(screen.queryByText('Ďalší tréning')).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Pokračovať' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Začať tréning' })).not.toBeInTheDocument()
  expect(getAssignedWorkouts).not.toHaveBeenCalled()
  expect(getActiveWorkout).not.toHaveBeenCalled()
})

it('renders the workout CTA for access_mode "both"', () => {
  vi.mocked(useAuth).mockReturnValue({ user: { id: 'athlete-1' }, profile: { access_mode: 'both' } } as unknown as ReturnType<typeof useAuth>)
  mockQueries({
    'activity:assigned': { data: [{ id: 'w1', name: 'Push Day', workout_exercises: [] }], isLoading: false },
    'activity:active': { data: null, isLoading: false },
  })
  render(<MemoryRouter initialEntries={['/nutrition']}><Hub /></MemoryRouter>)

  expect(screen.getByText('Ďalší tréning')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Začať tréning' })).toHaveAttribute('href', '/activity/workouts/w1')
  expect(getAssignedWorkouts).toHaveBeenCalledWith('athlete-1')
})

it('renders the workout CTA when access_mode is unset (null means full access)', () => {
  vi.mocked(useAuth).mockReturnValue({ user: { id: 'athlete-1' }, profile: { access_mode: null } } as unknown as ReturnType<typeof useAuth>)
  mockQueries({
    'activity:assigned': { data: [{ id: 'w1', name: 'Push Day', workout_exercises: [] }], isLoading: false },
    'activity:active': { data: null, isLoading: false },
  })
  render(<MemoryRouter initialEntries={['/nutrition']}><Hub /></MemoryRouter>)

  expect(screen.getByText('Ďalší tréning')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Začať tréning' })).toHaveAttribute('href', '/activity/workouts/w1')
  expect(getAssignedWorkouts).toHaveBeenCalledWith('athlete-1')
})

it('renders every block together when the athlete has a quote, meals, a plan, and an assigned workout', () => {
  mockQueries({
    activeQuote: { data: { id: 'q1', text: 'Consistency wins.', author: null }, isLoading: false },
    dailyLogs: {
      data: [{
        id: 'log-1', user_id: 'athlete-1', meal_name: 'Raňajky', meal_type: 'breakfast', notes: null,
        image_url: null, logged_at: '2026-08-04T07:15:00Z',
        meal_log_foods: [{ id: 'f1', meal_log_id: 'log-1', name: 'Ovsená kaša', amount: 300, unit: 'g', amount_grams: 300, calories: 420, protein_g: 15, carbs_g: 60, fat_g: 10 }],
      }],
      isLoading: false,
    },
    mealPlan: {
      data: {
        id: 'plan-1', name: 'Plán', description: null, valid_from: null, valid_to: null,
        meals: [{
          id: 'meal-1', meal_plan_id: 'plan-1', name: 'Obed', time_of_day: '12:00', sort_order: 0, day_of_week: null,
          meal_foods: [{ id: 'food-1', meal_id: 'meal-1', name: 'Kuracie prsia', amount_grams: 200, calories: 330, protein_g: 40, carbs_g: 0, fat_g: 8 }],
          meal_plan_recipes: [],
        }],
      },
      isLoading: false,
    },
    'activity:assigned': { data: [{ id: 'w1', name: 'Push Day', workout_exercises: [] }], isLoading: false },
    'activity:active': { data: null, isLoading: false },
  })
  render(<MemoryRouter initialEntries={['/nutrition']}><Hub /></MemoryRouter>)

  expect(screen.getByText('Consistency wins.')).toBeInTheDocument()
  expect(screen.getByText('Raňajky')).toBeInTheDocument()
  expect(screen.getByText('Dnešný jedálniček')).toBeInTheDocument()
  expect(screen.getByText('Kuracie prsia')).toBeInTheDocument()
  expect(screen.getByText('Ďalší tréning')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Začať tréning' })).toHaveAttribute('href', '/activity/workouts/w1')
})
