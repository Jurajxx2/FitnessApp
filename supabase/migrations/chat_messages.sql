-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chat_type    TEXT        NOT NULL CHECK (chat_type IN ('human', 'ai')),
    sender_type  TEXT        NOT NULL CHECK (sender_type IN ('user', 'coach', 'ai')),
    content_type TEXT        NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image')),
    text_content TEXT,
    image_url    TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at      TIMESTAMPTZ
);

-- Index for efficient per-user conversation queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_type
    ON chat_messages (user_id, chat_type, created_at DESC);

-- Enable Row Level Security
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can read and write only their own messages
CREATE POLICY "users_own_messages"
    ON chat_messages
    FOR ALL
    USING (auth.uid() = user_id);

-- Supabase Storage bucket for chat image attachments
-- Run this in the Supabase dashboard or via the Storage API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('chat-images', 'chat-images', false)
-- ON CONFLICT DO NOTHING;
