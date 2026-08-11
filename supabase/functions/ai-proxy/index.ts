import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { createAiProxyHandler, type AiProxyServices } from './handler.ts'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

const handler = createAiProxyHandler({
  aiConfigured: Boolean(anthropicKey),
  log: (level, event, fields) => console[level](event, JSON.stringify(fields)),
  async authenticate(authorization) {
    if (!supabaseUrl || !anonKey) return null
    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user }, error } = await client.auth.getUser()
    return error || !user ? null : user.id
  },
  createPrivilegedServices(): AiProxyServices {
    if (!supabaseUrl || !serviceKey || !anthropicKey) throw new Error('MISSING_SERVER_CONFIGURATION')
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    return {
      async getProfile(userId) {
        const { data, error } = await admin.from('profiles')
          .select('is_blocked, ai_access_enabled').eq('id', userId).maybeSingle()
        if (error) throw new Error('PROFILE_QUERY_FAILED')
        return data ? {
          isBlocked: data.is_blocked === true,
          aiAccessEnabled: data.ai_access_enabled === true,
        } : null
      },
      async reserveQuota(userId, inputChars, maxOutputTokens) {
        const { data, error } = await admin.rpc('reserve_ai_proxy_quota', {
          p_user_id: userId,
          p_input_chars: inputChars,
          p_max_output_tokens: maxOutputTokens,
        })
        if (error) throw new Error('QUOTA_RESERVATION_FAILED')
        return typeof data === 'string' ? data : null
      },
      async recordQuotaOutcome(reservationId, status, upstreamStatus) {
        const { data, error } = await admin.rpc('record_ai_proxy_quota_outcome', {
          p_reservation_id: reservationId,
          p_status: status,
          p_upstream_status: upstreamStatus ?? null,
        })
        if (error || data !== true) throw new Error('QUOTA_OUTCOME_FAILED')
      },
      async callUpstream(body) {
        return await fetch(ANTHROPIC_URL, {
          method: 'POST',
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': ANTHROPIC_VERSION,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })
      },
    }
  },
})

serve(handler)
