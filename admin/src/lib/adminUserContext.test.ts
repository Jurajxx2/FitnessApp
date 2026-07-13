import { describe, expect, it } from 'vitest'
import { appendUserContext, getUserContextReturn } from './adminUserContext'

describe('admin user context navigation', () => {
  it('returns to the selected user by name', () => {
    expect(getUserContextReturn('user-1', { full_name: 'Alex Novak', email: 'alex@example.com' }, '/admin/workouts', 'Back to workouts')).toEqual({
      to: '/admin/users/user-1',
      label: 'Back to Alex Novak',
    })
  })

  it('uses the normal editor collection when opened without a user', () => {
    expect(getUserContextReturn(null, undefined, '/admin/workouts', 'Back to workouts')).toEqual({
      to: '/admin/workouts',
      label: 'Back to workouts',
    })
  })

  it('keeps user context after a new plan receives its id', () => {
    expect(appendUserContext('/admin/workouts/workout-1', 'user 1')).toBe('/admin/workouts/workout-1?user=user%201')
  })
})
