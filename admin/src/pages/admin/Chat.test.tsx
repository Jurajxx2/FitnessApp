// admin/src/pages/admin/Chat.test.tsx
import { describe, it, expect } from 'vitest'
import type { ChatMessage, Profile } from '../../types/database'
import { buildConversationList, formatMessageTime } from './Chat'

function msg(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: '1',
    user_id: 'user-1',
    chat_type: 'human',
    sender_type: 'user',
    content_type: 'text',
    text_content: 'Hello',
    image_url: null,
    created_at: '2026-04-25T10:00:00Z',
    read_at: null,
    ...overrides,
  }
}

function profile(id: string, full_name: string | null = null): Profile {
  return {
    id,
    email: `${id}@test.com`,
    full_name,
    age: null, height_cm: null, weight_kg: null,
    goal: null, activity_level: null,
    onboarding_complete: true, is_admin: false, is_blocked: false, access_mode: 'both',
    admin_notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

describe('buildConversationList', () => {
  it('returns one entry per user_id sorted newest-last-message first', () => {
    const messages: ChatMessage[] = [
      msg({ user_id: 'u1', created_at: '2026-04-25T09:00:00Z' }),
      msg({ user_id: 'u2', created_at: '2026-04-25T11:00:00Z' }),
      msg({ id: '2', user_id: 'u1', created_at: '2026-04-25T10:00:00Z' }),
    ]
    const result = buildConversationList(messages, [profile('u1', 'Alice'), profile('u2', 'Bob')])
    expect(result).toHaveLength(2)
    expect(result[0].userId).toBe('u2') // newest last-message first
    expect(result[1].userId).toBe('u1')
  })

  it('counts only sender_type=user + read_at=null as unread', () => {
    const messages: ChatMessage[] = [
      msg({ id: '1', user_id: 'u1', sender_type: 'user',  read_at: null }),
      msg({ id: '2', user_id: 'u1', sender_type: 'user',  read_at: '2026-04-25T10:01:00Z' }),
      msg({ id: '3', user_id: 'u1', sender_type: 'coach', read_at: null }),
    ]
    const result = buildConversationList(messages, [profile('u1', 'Alice')])
    expect(result[0].unreadCount).toBe(1)
  })

  it('falls back to email when full_name is null', () => {
    const result = buildConversationList([msg({ user_id: 'u1' })], [profile('u1', null)])
    expect(result[0].displayName).toBe('u1@test.com')
  })

  it('uses the most recent message as lastPreview', () => {
    const messages: ChatMessage[] = [
      msg({ id: '1', user_id: 'u1', text_content: 'First',  created_at: '2026-04-25T09:00:00Z' }),
      msg({ id: '2', user_id: 'u1', text_content: 'Latest', created_at: '2026-04-25T10:00:00Z' }),
    ]
    const result = buildConversationList(messages, [profile('u1')])
    expect(result[0].lastPreview).toBe('Latest')
  })

  it('shows "📷 Image" preview for image messages', () => {
    const messages: ChatMessage[] = [
      msg({ user_id: 'u1', content_type: 'image', text_content: null, image_url: 'http://x.com/img.jpg' }),
    ]
    const result = buildConversationList(messages, [profile('u1')])
    expect(result[0].lastPreview).toBe('📷 Image')
  })
})

describe('formatMessageTime', () => {
  it('returns a HH:MM-style string from an ISO timestamp', () => {
    const result = formatMessageTime('2026-04-25T14:30:00Z')
    expect(result).toMatch(/^\d{1,2}:\d{2}/)
  })
})
