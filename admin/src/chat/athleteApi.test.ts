import { describe, expect, it } from 'vitest'
import { countUnreadFromCoach } from './athleteApi'
import type { ChatMessage } from '../types/database'

function message(overrides: Partial<ChatMessage> & { id: string }): ChatMessage {
  return {
    user_id: 'u1',
    chat_type: 'human',
    sender_type: 'coach',
    content_type: 'text',
    text_content: 'hello',
    image_url: null,
    created_at: '2026-07-13T10:00:00Z',
    read_at: null,
    ...overrides,
  }
}

describe('countUnreadFromCoach', () => {
  it('counts only unread coach messages', () => {
    const messages = [
      message({ id: '1' }),
      message({ id: '2', read_at: '2026-07-13T11:00:00Z' }),
      message({ id: '3', sender_type: 'user' }),
    ]

    expect(countUnreadFromCoach(messages)).toBe(1)
  })
})
