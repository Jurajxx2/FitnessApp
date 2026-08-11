// admin/src/pages/admin/Chat.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { NoticeProvider } from '../../components/ui'
import { logger } from '../../lib/logger'
import type { ChatMessage, Profile } from '../../types/database'
import Chat, { buildConversationList, formatMessageTime } from './Chat'

const { uploadMock, removeMock, insertMock, fromMock } = vi.hoisted(() => ({
  uploadMock: vi.fn().mockResolvedValue({ error: null }),
  removeMock: vi.fn().mockResolvedValue({ error: null }),
  insertMock: vi.fn().mockResolvedValue({ error: null }),
  fromMock: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: fromMock,
    storage: { from: () => ({ upload: uploadMock, remove: removeMock }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
  },
}))

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

describe('Chat — coach image send', () => {
  const ATHLETE_ID = 'athlete-1'

  // jsdom doesn't implement scrollIntoView; Chat.tsx calls it to keep the
  // thread scrolled to the latest message whenever it renders.
  Element.prototype.scrollIntoView = vi.fn()

  // Generic chainable Postgrest-like builder for the chat_messages table.
  // select/eq/order chain to a resolved read; insert/update are captured directly.
  function chatMessagesBuilder(insertError: Error | null = null): Record<string, unknown> {
    const readResult = Promise.resolve({
      data: [msg({ id: 'm1', user_id: ATHLETE_ID, text_content: 'Hi coach', created_at: '2026-08-01T09:00:00Z' })],
      error: null,
    })
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      is: () => Promise.resolve({ error: null }),
      limit: () => readResult,
      insert: (row: Record<string, unknown>) => {
        insertMock(row)
        return Promise.resolve({ error: insertError })
      },
      update: () => builder,
    }
    return builder
  }

  function renderChat(insertError: Error | null = null) {
    fromMock.mockImplementation((table: string) => {
      if (table === 'chat_messages') return chatMessagesBuilder(insertError)
      if (table === 'profiles') {
        return { select: () => ({ in: () => Promise.resolve({ data: [profile(ATHLETE_ID, 'Alice Athlete')], error: null }) }) }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const utils = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NoticeProvider>
            <Chat />
          </NoticeProvider>
        </MemoryRouter>
      </QueryClientProvider>
    )
    return utils
  }

  it('uploads a selected photo to chat-images and inserts a coach image row keyed on the athlete id', async () => {
    const { container } = renderChat()

    fireEvent.click(await screen.findByText('Alice Athlete'))
    await screen.findByLabelText('Send image')

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeTruthy()

    const file = new File(['fake-image-bytes'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => expect(uploadMock).toHaveBeenCalled())

    const [path, uploadedFile, options] = uploadMock.mock.calls[0]
    expect(path).toMatch(new RegExp(`^${ATHLETE_ID}/coach_\\d+\\.jpg$`))
    expect(uploadedFile).toBe(file)
    expect(options).toEqual({ contentType: 'image/jpeg' })

    await waitFor(() => expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: ATHLETE_ID,
        chat_type: 'human',
        sender_type: 'coach',
        content_type: 'image',
        image_url: path,
      })
    ))
  })

  it('removes the orphaned upload and surfaces the original insert error — even when the cleanup itself fails', async () => {
    const insertError = new Error('insert failed: RLS violation')
    const removeError = new Error('remove failed: object not found')
    const loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})
    removeMock.mockResolvedValueOnce({ error: removeError })

    const { container } = renderChat(insertError)

    fireEvent.click(await screen.findByText('Alice Athlete'))
    await screen.findByLabelText('Send image')

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['fake-image-bytes'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => expect(uploadMock).toHaveBeenCalled())
    const [path] = uploadMock.mock.calls[uploadMock.mock.calls.length - 1]

    // The just-uploaded object must be cleaned up with the exact path that was uploaded.
    await waitFor(() => expect(removeMock).toHaveBeenCalledWith([path]))

    // Even though the cleanup itself failed, the UI must surface the original
    // insert error — never the cleanup error — and must not swallow it.
    await screen.findByText(content => content.includes(insertError.message))
    expect(screen.queryByText(content => content.includes(removeError.message))).toBeNull()

    // The cleanup failure is logged, not thrown.
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.any(String), removeError)

    loggerErrorSpy.mockRestore()
  })
})
