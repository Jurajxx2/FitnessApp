// admin/src/pages/admin/Chat.tsx
import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { logger } from '../../lib/logger'
import type { ChatMessage, Profile } from '../../types/database'

// ─── Pure helpers (exported for tests) ──────────────────────────────────────

export interface ConversationSummary {
  userId: string
  displayName: string
  lastPreview: string
  lastMessageAt: string
  unreadCount: number
}

export function buildConversationList(
  messages: ChatMessage[],
  profiles: Profile[]
): ConversationSummary[] {
  const profileMap = new Map(profiles.map(p => [p.id, p]))
  const byUser = new Map<string, ChatMessage[]>()

  for (const m of messages) {
    const list = byUser.get(m.user_id) ?? []
    list.push(m)
    byUser.set(m.user_id, list)
  }

  const summaries: ConversationSummary[] = []
  for (const [userId, msgs] of byUser) {
    const sorted = [...msgs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    const last = sorted[0]
    const p = profileMap.get(userId)
    summaries.push({
      userId,
      displayName: p?.full_name ?? p?.email ?? userId,
      lastPreview: last.content_type === 'image' ? '📷 Image' : (last.text_content ?? ''),
      lastMessageAt: last.created_at,
      unreadCount: msgs.filter(m => m.sender_type === 'user' && m.read_at === null).length,
    })
  }

  return summaries.sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  )
}

export function formatMessageTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ─── Data hooks ──────────────────────────────────────────────────────────────

function useChatMessages() {
  return useQuery<ChatMessage[]>({
    queryKey: ['admin-chat-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_type', 'human')
        .order('created_at', { ascending: false })
        .limit(2000)
      if (error) throw error
      return data ?? []
    },
  })
}

function useChatProfiles(userIds: string[]) {
  return useQuery<Profile[]>({
    queryKey: ['admin-chat-profiles', [...userIds].sort().join(',')],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds)
      if (error) throw error
      return data ?? []
    },
  })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Chat() {
  const qc = useQueryClient()
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: allMessages = [], isLoading } = useChatMessages()

  const distinctUserIds = [...new Set(allMessages.map(m => m.user_id))]
  const { data: profiles = [] } = useChatProfiles(distinctUserIds)

  const conversations = buildConversationList(allMessages, profiles)
  const threadMessages = allMessages
    .filter(m => m.user_id === selectedUserId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [threadMessages.length, selectedUserId])

  // Mark user messages as read when opening a conversation
  const markRead = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('chat_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('chat_type', 'human')
        .eq('sender_type', 'user')
        .is('read_at', null)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-chat-messages'] }),
    onError: (err) => logger.error('Failed to mark messages as read', err),
  })

  function selectUser(userId: string) {
    setSelectedUserId(userId)
    markRead.mutate(userId)
  }

  const sendMessage = useMutation({
    mutationFn: async ({ userId, message }: { userId: string; message: string }) => {
      const { error } = await supabase.from('chat_messages').insert({
        user_id: userId,
        chat_type: 'human',
        sender_type: 'coach',
        content_type: 'text',
        text_content: message,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-chat-messages'] })
      setText('')
    },
    onError: (_err, { message }) => setText(message),
  })

  function handleSend() {
    if (!text.trim() || !selectedUserId) return
    sendMessage.mutate({ userId: selectedUserId, message: text.trim() })
  }

  // Realtime: invalidate cache on any new human chat insert.
  // Unique channel name per mount avoids Strict Mode double-mount teardown issues.
  useEffect(() => {
    const channel = supabase
      .channel(`admin-chat-realtime-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: 'chat_type=eq.human' },
        () => qc.invalidateQueries({ queryKey: ['admin-chat-messages'] })
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [qc])

  const selectedProfile = profiles.find(p => p.id === selectedUserId)

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* Left: conversation list */}
      <div className="w-64 flex-shrink-0 border-r border-[var(--border)] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
            Conversations
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="text-xs text-[var(--text-disabled)] p-4">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="text-xs text-[var(--text-disabled)] p-4">No conversations yet</p>
          ) : (
            conversations.map(c => (
              <button
                key={c.userId}
                onClick={() => selectUser(c.userId)}
                className={`w-full text-left px-4 py-3 border-b border-[var(--border)] border-x-0 border-t-0 flex items-start gap-2 cursor-pointer bg-transparent transition-colors ${
                  selectedUserId === c.userId
                    ? 'bg-[var(--sidebar-active-bg)]'
                    : 'hover:bg-[var(--bg-card-hover)]'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-semibold text-[var(--text)] truncate">{c.displayName}</p>
                    {c.unreadCount > 0 && (
                      <span className="flex-shrink-0 bg-blue-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                        {c.unreadCount > 9 ? '9+' : c.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-disabled)] truncate mt-0.5">{c.lastPreview}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right: message thread */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedUserId ? (
          <>
            <div className="px-5 py-3 border-b border-[var(--border)] flex-shrink-0">
              <p className="text-sm font-semibold text-[var(--text)]">
                {selectedProfile?.full_name ?? selectedProfile?.email ?? selectedUserId}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
              {threadMessages.map(m => (
                <div
                  key={m.id}
                  className={`flex ${m.sender_type === 'coach' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] px-3 py-2 rounded-xl text-sm ${
                      m.sender_type === 'coach'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[var(--bg-card)] text-[var(--text)]'
                    }`}
                  >
                    {m.content_type === 'image' && m.image_url ? (
                      <img src={m.image_url} alt="Chat attachment" className="rounded-lg max-w-[200px]" />
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{m.text_content}</p>
                    )}
                    <p className={`text-[10px] mt-1 ${
                      m.sender_type === 'coach' ? 'text-blue-200' : 'text-[var(--text-disabled)]'
                    }`}>
                      {formatMessageTime(m.created_at)}
                      {m.sender_type === 'coach' && m.read_at && ' ✓'}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-5 py-3 border-t border-[var(--border)] flex-shrink-0 flex gap-2 items-end">
              <textarea
                className="flex-1 bg-[var(--input-bg)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-disabled)] outline-none focus:border-[var(--text-muted)] resize-none"
                rows={2}
                placeholder="Reply as coach… (Enter to send, Shift+Enter for newline)"
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
              />
              <button
                onClick={handleSend}
                disabled={!text.trim() || sendMessage.isPending}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-0"
              >
                {sendMessage.isPending ? '…' : 'Send'}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-[var(--text-disabled)]">Select a conversation to start chatting</p>
          </div>
        )}
      </div>
    </div>
  )
}
