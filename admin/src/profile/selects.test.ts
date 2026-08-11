import { describe, expect, it } from 'vitest'
import { CHAT_PROFILE_SELECT, PROFILE_SELECT } from './selects'

describe('safe profile projections', () => {
  it('lists the complete ordinary profile shape without wildcard or coach notes', () => {
    expect(PROFILE_SELECT.split(', ')).toEqual([
      'id',
      'email',
      'full_name',
      'age',
      'height_cm',
      'weight_kg',
      'gender',
      'goal',
      'activity_level',
      'onboarding_complete',
      'is_admin',
      'is_blocked',
      'access_mode',
      'created_at',
      'updated_at',
    ])
    expect(PROFILE_SELECT).not.toContain('*')
    expect(PROFILE_SELECT).not.toContain('admin_notes')
  })

  it('keeps chat profile reads to identity fields only', () => {
    expect(CHAT_PROFILE_SELECT).toBe('id, email, full_name')
    expect(CHAT_PROFILE_SELECT).not.toContain('admin_notes')
  })
})
