import { describe, it, expect, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { applyActiveQuote } from './Quotes'

describe('quote activation', () => {
  it('sets only the selected quote as active', () => {
    const quotes = [
      { id: '1', is_active: true },
      { id: '2', is_active: false },
      { id: '3', is_active: false },
    ]
    const result = applyActiveQuote(quotes, '2')
    expect(result.find(q => q.id === '1')?.is_active).toBe(false)
    expect(result.find(q => q.id === '2')?.is_active).toBe(true)
    expect(result.find(q => q.id === '3')?.is_active).toBe(false)
  })

  it('deactivates all when given an id that does not exist', () => {
    const quotes = [{ id: '1', is_active: true }]
    const result = applyActiveQuote(quotes, 'nonexistent')
    expect(result.every(q => !q.is_active)).toBe(true)
  })
})
