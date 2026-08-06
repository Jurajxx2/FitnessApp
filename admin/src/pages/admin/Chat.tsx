// admin/src/pages/admin/Chat.tsx
import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { ImagePlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { logger } from '../../lib/logger'
import type { ChatMessage, Profile } from '../../types/database'
import { SearchInput, useNotice } from '../../components/ui'
import { ChatImage } from '../../chat/ChatImage'

const CHAT_IMAGES_BUCKET = 'chat-images'

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
  const { notify } = useNotice()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [conversationSearch, setConversationSearch] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const { data: allMessages = [], isLoading } = useChatMessages()

  const distinctUserIds = [...new Set(allMessages.map(m => m.user_id))]
  const profileUserIds = selectedUserId ? [...new Set([...distinctUserIds, selectedUserId])] : distinctUserIds
  const { data: profiles = [] } = useChatProfiles(profileUserIds)

  const conversations = buildConversationList(allMessages, profiles)
  const visibleConversations = conversations.filter(conversation => {
    const query = conversationSearch.trim().toLowerCase()
    return !query || conversation.displayName.toLowerCase().includes(query) || conversation.lastPreview.toLowerCase().includes(query)
  })
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
    onError: (err) => {
      logger.error('Failed to mark messages as read', err)
      notify('Couldn’t mark the conversation as read.', 'error')
    },
  })

  function selectUser(userId: string) {
    setSelectedUserId(userId)
    markRead.mutate(userId)
  }

  useEffect(() => {
    const requestedUserId = searchParams.get('user')
    if (!requestedUserId) return
    selectUser(requestedUserId)
    const next = new URLSearchParams(searchParams)
    next.delete('user')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

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
    onError: (error, { message }) => {
      setText(message)
      notify(`Couldn’t send message: ${error.message}`, 'error')
    },
  })

  function handleSend() {
    if (!text.trim() || !selectedUserId) return
    sendMessage.mutate({ userId: selectedUserId, message: text.trim() })
  }

  // Mirrors the athlete's sendImageMessage (chat/athleteApi.ts) but keyed with a
  // `coach_` prefix so the sender is evident in storage. The row's user_id stays
  // the athlete's id — that's what RLS and the athlete's read path expect — even
  // though the upload itself is performed by the coach's own auth session.
  const sendImage = useMutation({
    mutationFn: async ({ userId, file }: { userId: string; file: File }) => {
      const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `${userId}/coach_${Date.now()}.${extension}`
      const { error: uploadError } = await supabase.storage
        .from(CHAT_IMAGES_BUCKET)
        .upload(path, file, { contentType: file.type })
      if (uploadError) throw uploadError

      const { error } = await supabase.from('chat_messages').insert({
        user_id: userId,
        chat_type: 'human',
        sender_type: 'coach',
        content_type: 'image',
        image_url: path,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-chat-messages'] }),
    onError: error => {
      logger.error('Failed to send chat image', error)
      notify(`Couldn’t send image: ${error.message}`, 'error')
    },
  })

  function handleImageSelected(file: File) {
    if (!selectedUserId) return
    sendImage.mutate({ userId: selectedUserId, file })
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
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Left: conversation list */}
      <div className={`${selectedUserId ? 'hidden sm:flex' : 'flex'} w-full sm:w-72 flex-shrink-0 flex-col overflow-hidden border-r border-outline`}>
        <div className="flex-shrink-0 border-b border-outline px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Conversations</p>
            {!isLoading && <span className="text-xs text-text-secondary">{visibleConversations.length}</span>}
          </div>
          <SearchInput
            value={conversationSearch}
            onChange={event => setConversationSearch(event.target.value)}
            onClear={() => setConversationSearch('')}
            placeholder="Search conversations…"
            className="mt-3"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="p-4 text-xs text-text-secondary">Loading…</p>
          ) : visibleConversations.length === 0 ? (
            <p className="p-4 text-xs text-text-secondary">{conversationSearch ? 'No conversations match this search' : 'No conversations yet'}</p>
          ) : (
            visibleConversations.map(c => (
              <button
                key={c.userId}
                onClick={() => selectUser(c.userId)}
                className={`flex w-full cursor-pointer items-start gap-2 border-x-0 border-b border-t-0 border-outline bg-transparent px-4 py-3 text-left transition-colors ${
                  selectedUserId === c.userId
                    ? 'bg-surface-elevated'
                    : 'hover:bg-surface-highest'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="truncate text-xs font-semibold text-text-primary">{c.displayName}</p>
                    {c.unreadCount > 0 && (
                      <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-on-accent">
                        {c.unreadCount > 9 ? '9+' : c.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-text-secondary">{c.lastPreview}</p>
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
            <div className="flex flex-shrink-0 items-center gap-3 border-b border-outline px-5 py-3">
              <button onClick={() => setSelectedUserId(null)} className="cursor-pointer border-0 bg-transparent p-0 text-sm font-medium text-text-secondary hover:text-text-primary sm:hidden">
                ← Back
              </button>
              <p className="text-sm font-semibold text-text-primary">
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
                        ? 'bg-action-primary text-on-action-primary'
                        : 'bg-surface-elevated text-text-primary'
                    }`}
                  >
                    {m.content_type === 'image' && m.image_url ? (
                      <ChatImage
                        imageRef={m.image_url}
                        alt="Chat attachment"
                        className="rounded-lg max-w-[200px]"
                        unavailableText="Couldn’t load image."
                      />
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{m.text_content}</p>
                    )}
                    <p className={`text-[10px] mt-1 ${
                      m.sender_type === 'coach' ? 'opacity-70' : 'text-text-secondary'
                    }`}>
                      {formatMessageTime(m.created_at)}
                      {m.sender_type === 'coach' && m.read_at && ' ✓'}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex flex-shrink-0 items-end gap-2 border-t border-outline px-5 py-3">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={event => {
                  const file = event.target.files?.[0]
                  if (file) handleImageSelected(file)
                  event.target.value = ''
                }}
              />
              <button
                type="button"
                aria-label="Send image"
                disabled={sendImage.isPending}
                onClick={() => imageInputRef.current?.click()}
                className="flex h-11 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-xl border border-outline bg-surface text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sendImage.isPending ? '…' : <ImagePlus size={18} />}
              </button>
              <textarea
                className="flex-1 resize-none rounded-xl border border-outline bg-surface px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary focus:border-accent"
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
                className="cursor-pointer rounded-xl border-0 bg-action-primary px-4 py-2 text-sm font-semibold text-on-action-primary hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendMessage.isPending ? '…' : 'Send'}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-text-secondary">Select a conversation to start chatting</p>
          </div>
        )}
      </div>
    </div>
  )
}
