import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { parseAdminUserRequest, type AdminUserAction } from './logic.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function actionError(action: AdminUserAction): string {
  switch (action) {
    case 'block': return 'Unable to disable the user'
    case 'unblock': return 'Unable to activate the user'
    case 'promote_admin': return 'Unable to grant admin access'
    case 'delete': return 'Unable to delete the user'
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.error('Supabase environment is not configured')
      return json({ error: 'Service is not configured' }, 500)
    }

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
    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from('profiles')
      .select('is_admin, is_blocked')
      .eq('id', caller.id)
      .maybeSingle()
    if (callerProfileError) {
      console.error('Unable to resolve caller role', { callerId: caller.id, error: callerProfileError.message })
      return json({ error: 'Unable to verify permissions' }, 500)
    }
    if (!callerProfile?.is_admin || callerProfile.is_blocked) return json({ error: 'Admin access required' }, 403)

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Request body must be valid JSON' }, 400)
    }
    const request = parseAdminUserRequest(body)
    if (!request) return json({ error: 'Provide a valid action and user id' }, 400)
    if (request.userId === caller.id) return json({ error: 'You cannot change your own account access' }, 409)

    const { data: target, error: targetError } = await adminClient
      .from('profiles')
      .select('id, is_admin, is_blocked')
      .eq('id', request.userId)
      .maybeSingle()
    if (targetError) {
      console.error('Unable to resolve target user', { callerId: caller.id, targetId: request.userId, error: targetError.message })
      return json({ error: actionError(request.action) }, 500)
    }
    if (!target) return json({ error: 'User not found' }, 404)
    if (target.is_admin) return json({ error: 'Existing admin accounts cannot be changed here' }, 409)

    if (request.action === 'delete') {
      const { error } = await adminClient.auth.admin.deleteUser(request.userId)
      if (error) {
        console.error('Unable to delete user', { callerId: caller.id, targetId: request.userId, error: error.message })
        return json({ error: actionError(request.action) }, 400)
      }
      return json({ action: request.action, userId: request.userId })
    }

    const patch = request.action === 'promote_admin'
      ? { is_admin: true, is_blocked: false }
      : { is_blocked: request.action === 'block' }
    const { error: updateError } = await adminClient
      .from('profiles')
      .update(patch)
      .eq('id', request.userId)
    if (updateError) {
      console.error('Unable to update user access', { callerId: caller.id, targetId: request.userId, action: request.action, error: updateError.message })
      return json({ error: actionError(request.action) }, 400)
    }

    return json({ action: request.action, userId: request.userId })
  } catch (error) {
    console.error('admin-manage-user failed', { error: error instanceof Error ? error.message : 'Unknown error' })
    return json({ error: 'Unable to manage the user' }, 500)
  }
})
