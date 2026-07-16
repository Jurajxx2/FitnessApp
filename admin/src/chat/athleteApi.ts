import { supabase } from '../lib/supabase'
import type { ChatMessage } from '../types/database'

const CHAT_IMAGES_BUCKET = 'chat-images'

function chatImagePath(imageRef: string): string | null {
  if (!imageRef.startsWith('http://') && !imageRef.startsWith('https://')) return imageRef

  try {
    const pathname = new URL(imageRef).pathname
    const marker = `/storage/v1/object/public/${CHAT_IMAGES_BUCKET}/`
    const markerIndex = pathname.indexOf(marker)
    if (markerIndex === -1) return null
    const encodedPath = pathname.slice(markerIndex + marker.length)
    return encodedPath ? decodeURIComponent(encodedPath) : null
  } catch {
    return null
  }
}

/** Resolves a private chat object path for the authenticated reader. */
export async function resolveChatImageUrl(imageRef: string): Promise<string> {
  const path = chatImagePath(imageRef)
  if (!path) return imageRef

  const { data, error } = await supabase.storage
    .from(CHAT_IMAGES_BUCKET)
    .createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

export async function fetchMyMessages(userId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', userId)
    .eq('chat_type', 'human')
    .order('created_at', { ascending: true })
    .limit(500)

  if (error) throw error
  return (data ?? []) as ChatMessage[]
}

export async function sendTextMessage(userId: string, text: string): Promise<void> {
  const { error } = await supabase.from('chat_messages').insert({
    user_id: userId,
    chat_type: 'human',
    sender_type: 'user',
    content_type: 'text',
    text_content: text,
  })

  if (error) throw error
}

export async function sendImageMessage(userId: string, file: File): Promise<void> {
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  // Storage INSERT policy requires the first path segment to equal auth.uid().
  const path = `${userId}/chat_${Date.now()}.${extension}`
  const { error: uploadError } = await supabase.storage
    .from(CHAT_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type })

  if (uploadError) throw uploadError

  const { error } = await supabase.from('chat_messages').insert({
    user_id: userId,
    chat_type: 'human',
    sender_type: 'user',
    content_type: 'image',
    // Keep the private object path, never a public or long-lived signed URL.
    image_url: path,
  })

  if (error) throw error
}

export async function markCoachMessagesRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('chat_type', 'human')
    .eq('sender_type', 'coach')
    .is('read_at', null)

  if (error) throw error
}

export function countUnreadFromCoach(messages: ChatMessage[]): number {
  return messages.filter(item => item.sender_type === 'coach' && item.read_at === null).length
}
