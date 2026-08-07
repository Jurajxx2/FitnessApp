// admin/src/pages/admin/UserDetail.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { useQuery } from '@tanstack/react-query'
import {
  WorkoutLogsSection,
  MealLogsSection,
  WorkoutLogsHistorySlideOver,
  MealLogsHistorySlideOver,
  useRecentWorkoutLogs,
  useRecentMealLogs,
} from './UserDetail'
import { supabase } from '../../lib/supabase'

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))
vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn() } }))

afterEach(() => cleanup())

// ─── "View all" trigger on the preview sections ─────────────────────────────

describe('WorkoutLogsSection', () => {
  it('renders a "View all" control that calls onViewAll', () => {
    const onViewAll = vi.fn()
    render(
      <WorkoutLogsSection
        logs={[]}
        isLoading={false}
        error={null}
        feedback={[]}
        onAddFeedback={() => {}}
        onDeleteFeedback={() => {}}
        isFeedbackPending={false}
        onViewAll={onViewAll}
      />
    )
    fireEvent.click(screen.getByText('View all'))
    expect(onViewAll).toHaveBeenCalledTimes(1)
  })
})

describe('MealLogsSection', () => {
  it('renders a "View all" control that calls onViewAll', () => {
    const onViewAll = vi.fn()
    render(<MealLogsSection logs={[]} isLoading={false} error={null} onViewAll={onViewAll} />)
    fireEvent.click(screen.getByText('View all'))
    expect(onViewAll).toHaveBeenCalledTimes(1)
  })
})

// ─── Full log history slide-overs ────────────────────────────────────────────

const WORKOUT_LOG = {
  id: 'log-1',
  user_id: 'athlete-1',
  workout_id: 'w1',
  workout_name: 'Push Day',
  duration_minutes: 45,
  notes: null,
  status: 'completed',
  logged_at: '2026-08-01T09:00:00Z',
  created_at: '2026-08-01T09:00:00Z',
  exercise_logs: [],
}

const MEAL_LOG = {
  id: 'meal-1',
  user_id: 'athlete-1',
  meal_name: 'Breakfast',
  notes: null,
  image_url: null,
  logged_at: '2026-08-01T08:00:00Z',
  created_at: '2026-08-01T08:00:00Z',
  meal_log_foods: [],
}

describe('WorkoutLogsHistorySlideOver', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the full paginated list with a Date column when open', () => {
    vi.mocked(useQuery).mockReturnValue({ data: { data: [WORKOUT_LOG], count: 45 }, isLoading: false } as any)
    render(<WorkoutLogsHistorySlideOver userId="athlete-1" open={true} onClose={() => {}} />)

    expect(screen.getByText('Date')).toBeDefined()
    expect(screen.getByText('Push Day')).toBeDefined()
    expect(screen.getByText('45 min')).toBeDefined()
    // Pagination footer reflects the server-reported total, not just this page's rows.
    expect(screen.getByText('1–20 of 45')).toBeDefined()
  })

  it('requests the next 20-row range (not the 5-row preview limit) when paging forward', async () => {
    vi.mocked(useQuery).mockReturnValue({ data: { data: [WORKOUT_LOG], count: 45 }, isLoading: false } as any)
    render(<WorkoutLogsHistorySlideOver userId="athlete-1" open={true} onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))

    const calls = vi.mocked(useQuery).mock.calls
    const lastConfig = calls[calls.length - 1]![0] as { queryKey: unknown[]; queryFn: () => Promise<unknown> }
    expect(lastConfig.queryKey).toEqual(['user-workout-logs-history', 'athlete-1', 1, 20])

    let capturedRange: [number, number] | null = null
    // Offset pagination over a non-unique logged_at sort key lets rows shift between
    // page requests, so the query must also tie-break on the unique id column.
    const capturedOrderCalls: Array<[string, unknown]> = []
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      order: (column: string, options?: unknown) => { capturedOrderCalls.push([column, options]); return builder },
      range: (from: number, to: number) => {
        capturedRange = [from, to]
        return Promise.resolve({ data: [], count: 45, error: null })
      },
    }
    vi.mocked(supabase.from).mockReturnValue(builder)

    await lastConfig.queryFn()
    expect(capturedRange).toEqual([20, 39])
    expect(capturedOrderCalls).toEqual([['logged_at', { ascending: false }], ['id', undefined]])
  })

  it('does not fetch when the panel is closed', () => {
    vi.mocked(useQuery).mockReturnValue({ data: undefined, isLoading: false } as any)
    render(<WorkoutLogsHistorySlideOver userId="athlete-1" open={false} onClose={() => {}} />)

    const queryCalls = vi.mocked(useQuery).mock.calls
    const lastConfig = queryCalls[queryCalls.length - 1]![0] as { enabled: boolean }
    expect(lastConfig.enabled).toBe(false)
  })
})

describe('MealLogsHistorySlideOver', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the full paginated list with a Date column when open', () => {
    vi.mocked(useQuery).mockReturnValue({ data: { data: [MEAL_LOG], count: 12 }, isLoading: false } as any)
    render(<MealLogsHistorySlideOver userId="athlete-1" open={true} onClose={() => {}} />)

    expect(screen.getByText('Date')).toBeDefined()
    expect(screen.getByText('Breakfast')).toBeDefined()
  })

  it('requests the next 20-row range when paging forward', async () => {
    vi.mocked(useQuery).mockReturnValue({ data: { data: [MEAL_LOG], count: 41 }, isLoading: false } as any)
    render(<MealLogsHistorySlideOver userId="athlete-1" open={true} onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))

    const calls = vi.mocked(useQuery).mock.calls
    const lastConfig = calls[calls.length - 1]![0] as { queryKey: unknown[]; queryFn: () => Promise<unknown> }
    expect(lastConfig.queryKey).toEqual(['user-meal-logs-history', 'athlete-1', 1, 20])

    let capturedRange: [number, number] | null = null
    // Same tie-break requirement as the workout-log history query above.
    const capturedOrderCalls: Array<[string, unknown]> = []
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      order: (column: string, options?: unknown) => { capturedOrderCalls.push([column, options]); return builder },
      range: (from: number, to: number) => {
        capturedRange = [from, to]
        return Promise.resolve({ data: [], count: 41, error: null })
      },
    }
    vi.mocked(supabase.from).mockReturnValue(builder)

    await lastConfig.queryFn()
    expect(capturedRange).toEqual([20, 39])
    expect(capturedOrderCalls).toEqual([['logged_at', { ascending: false }], ['id', undefined]])
  })
})

// ─── The 5-row preview queries stay exactly as they were ────────────────────

describe('preview queries are unchanged by the history feature', () => {
  beforeEach(() => vi.clearAllMocks())

  it('useRecentWorkoutLogs still limits to 5 rows via .limit(), never .range()', async () => {
    let limitArg: number | undefined
    let rangeCalled = false
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: (n: number) => { limitArg = n; return Promise.resolve({ data: [], error: null }) },
      range: () => { rangeCalled = true; return Promise.resolve({ data: [], count: 0, error: null }) },
    }
    vi.mocked(supabase.from).mockReturnValue(builder)

    useRecentWorkoutLogs('athlete-1')
    const workoutCalls = vi.mocked(useQuery).mock.calls
    const lastConfig = workoutCalls[workoutCalls.length - 1]![0] as { queryKey: unknown[]; queryFn: () => Promise<unknown> }
    expect(lastConfig.queryKey).toEqual(['user-workout-logs', 'athlete-1'])

    await lastConfig.queryFn()
    expect(limitArg).toBe(5)
    expect(rangeCalled).toBe(false)
  })

  it('useRecentMealLogs still limits to 5 rows via .limit(), never .range()', async () => {
    let limitArg: number | undefined
    let rangeCalled = false
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: (n: number) => { limitArg = n; return Promise.resolve({ data: [], error: null }) },
      range: () => { rangeCalled = true; return Promise.resolve({ data: [], count: 0, error: null }) },
    }
    vi.mocked(supabase.from).mockReturnValue(builder)

    useRecentMealLogs('athlete-1')
    const mealCalls = vi.mocked(useQuery).mock.calls
    const lastConfig = mealCalls[mealCalls.length - 1]![0] as { queryKey: unknown[]; queryFn: () => Promise<unknown> }
    expect(lastConfig.queryKey).toEqual(['user-meal-logs', 'athlete-1'])

    await lastConfig.queryFn()
    expect(limitArg).toBe(5)
    expect(rangeCalled).toBe(false)
  })
})
