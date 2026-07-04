import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
// Model and limits are pinned server-side so a stolen client build cannot
// escalate cost by requesting a bigger model or more tokens.
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 1024
const MAX_MESSAGES = 100
const MAX_TOTAL_CHARS = 100_000

interface ProxyMessage {
  role: string
  content: string
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function validateBody(body: unknown): { system: string; messages: ProxyMessage[] } | string {
  if (typeof body !== 'object' || body === null) return 'Body must be a JSON object'
  const { system, messages } = body as Record<string, unknown>
  if (typeof system !== 'string') return '"system" must be a string'
  if (!Array.isArray(messages) || messages.length === 0) return '"messages" must be a non-empty array'
  if (messages.length > MAX_MESSAGES) return `"messages" exceeds ${MAX_MESSAGES} entries`

  let totalChars = system.length
  for (const msg of messages) {
    if (typeof msg !== 'object' || msg === null) return 'Each message must be an object'
    const { role, content } = msg as Record<string, unknown>
    if (role !== 'user' && role !== 'assistant') return 'Message role must be "user" or "assistant"'
    if (typeof content !== 'string' || content.length === 0) return 'Message content must be a non-empty string'
    totalChars += content.length
  }
  if (totalChars > MAX_TOTAL_CHARS) return `Payload exceeds ${MAX_TOTAL_CHARS} characters`

  return { system, messages: messages as ProxyMessage[] }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405)
  }

  try {
    // Verify the caller is an authenticated Supabase user. The platform-level
    // verify_jwt check only proves the token is signed; getUser() also rejects
    // the bare anon key and revoked sessions.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonError('Missing Authorization header', 401)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return jsonError('Invalid or expired token', 401)
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY secret is not set')
      return jsonError('AI proxy is not configured', 500)
    }

    const validated = validateBody(await req.json())
    if (typeof validated === 'string') {
      return jsonError(validated, 400)
    }

    const anthropicResponse = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: validated.system,
        messages: validated.messages,
        stream: true,
      }),
    })

    if (!anthropicResponse.ok || !anthropicResponse.body) {
      const detail = await anthropicResponse.text()
      console.error(`Anthropic API error ${anthropicResponse.status}: ${detail}`)
      return jsonError('Upstream AI request failed', 502)
    }

    // SSE passthrough — pipe Anthropic's stream straight to the client.
    return new Response(anthropicResponse.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    return jsonError(error.message, 400)
  }
})
