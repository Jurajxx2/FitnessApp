import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_NAME_LENGTH = 120
const MAX_EMAIL_LENGTH = 254
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface InviteRequest {
  email: string
  fullName: string
}

function json(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function parseInviteRequest(body: unknown): InviteRequest | null {
  if (typeof body !== 'object' || body === null) return null

  const { email, fullName } = body as Record<string, unknown>
  if (typeof email !== 'string' || typeof fullName !== 'string') return null

  const normalizedEmail = email.trim().toLowerCase()
  const normalizedName = fullName.trim().replace(/\s+/g, ' ')
  if (
    !normalizedName ||
    normalizedName.length > MAX_NAME_LENGTH ||
    normalizedEmail.length > MAX_EMAIL_LENGTH ||
    !emailPattern.test(normalizedEmail)
  ) {
    return null
  }

  return { email: normalizedEmail, fullName: normalizedName }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.error('Supabase environment is not configured')
      return json({ error: 'Service is not configured' }, 500)
    }

    // Do not trust a decoded JWT alone. getUser() validates the caller with
    // Supabase Auth and also rejects an anon key passed as Authorization.
    const authorization = req.headers.get('Authorization')
    if (!authorization) return json({ error: 'Authentication required' }, 401)

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser()
    if (callerError || !caller) return json({ error: 'Authentication required' }, 401)

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: callerProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('is_admin')
      .eq('id', caller.id)
      .maybeSingle()
    if (profileError) {
      console.error('Unable to resolve caller role', { callerId: caller.id, error: profileError.message })
      return json({ error: 'Unable to verify permissions' }, 500)
    }
    if (!callerProfile?.is_admin) return json({ error: 'Admin access required' }, 403)

    let requestBody: unknown
    try {
      requestBody = await req.json()
    } catch {
      return json({ error: 'Request body must be valid JSON' }, 400)
    }
    const invite = parseInviteRequest(requestBody)
    if (!invite) {
      return json({ error: 'Provide a valid email address and a name up to 120 characters' }, 400)
    }

    // Admin Auth APIs require the service-role key, so they are intentionally
    // called only from this server-side function after the admin-role check.
    const { data, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(invite.email, {
      data: { full_name: invite.fullName },
    })
    if (inviteError) {
      console.error('Unable to invite user', { callerId: caller.id, error: inviteError.message })
      const duplicate = inviteError.code === 'email_exists' || inviteError.code === 'user_already_exists'
      return json({ error: duplicate ? 'A user with this email already exists' : 'Unable to send the invitation' }, 400)
    }
    if (!data.user) {
      console.error('Invite succeeded without returning a user', { callerId: caller.id })
      return json({ error: 'Unable to create the user' }, 500)
    }

    return json({ user: { id: data.user.id, email: invite.email } }, 201)
  } catch (error) {
    console.error('admin-create-user failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return json({ error: 'Unable to create the user' }, 500)
  }
})
