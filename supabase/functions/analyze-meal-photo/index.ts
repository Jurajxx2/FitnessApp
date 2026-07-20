import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import {
  analysisPrompt,
  geminiGenerationConfig,
  MAX_IMAGE_BYTES,
  parseAnalysisRequest,
  parseMealAnalysis,
} from './logic.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const GEMINI_MODEL = 'gemini-3.5-flash'
const REQUEST_CHARACTER_LIMIT = Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 2048

type ErrorCode =
  | 'METHOD_NOT_ALLOWED'
  | 'AUTH_REQUIRED'
  | 'ACCESS_DENIED'
  | 'INVALID_REQUEST'
  | 'PAYLOAD_TOO_LARGE'
  | 'NOT_CONFIGURED'
  | 'RATE_LIMITED'
  | 'PROVIDER_TIMEOUT'
  | 'ANALYSIS_FAILED'
  | 'INTERNAL_ERROR'

function json(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function jsonError(code: ErrorCode, message: string, status: number): Response {
  return json({ error: { code, message } }, status)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonError('METHOD_NOT_ALLOWED', 'Method not allowed', 405)

  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > REQUEST_CHARACTER_LIMIT) {
    return jsonError('PAYLOAD_TOO_LARGE', 'Image is too large', 413)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.error('Supabase environment is not configured')
      return jsonError('NOT_CONFIGURED', 'Meal analysis is not configured', 503)
    }

    const authorization = req.headers.get('Authorization')
    if (!authorization) return jsonError('AUTH_REQUIRED', 'Authentication required', 401)

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: { user }, error: authError } = await callerClient.auth.getUser()
    if (authError || !user) return jsonError('AUTH_REQUIRED', 'Authentication required', 401)

    const rawBody = await req.text()
    if (rawBody.length > REQUEST_CHARACTER_LIMIT) return jsonError('PAYLOAD_TOO_LARGE', 'Image is too large', 413)
    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return jsonError('INVALID_REQUEST', 'Request body must be valid JSON', 400)
    }
    const request = parseAnalysisRequest(body)
    if (!request) return jsonError('INVALID_REQUEST', 'Provide a supported, bounded meal image', 400)

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('is_blocked, access_mode')
      .eq('id', user.id)
      .maybeSingle()
    if (profileError) {
      console.error('Unable to verify meal analysis access', { userId: user.id, error: profileError.message })
      return jsonError('INTERNAL_ERROR', 'Unable to verify access', 500)
    }
    if (!profile || profile.is_blocked || !['nutrition', 'both'].includes(profile.access_mode)) {
      return jsonError('ACCESS_DENIED', 'Nutrition access required', 403)
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      console.error('GEMINI_API_KEY secret is not set')
      return jsonError('NOT_CONFIGURED', 'Meal analysis is not configured', 503)
    }

    const { data: quotaReserved, error: quotaError } = await adminClient.rpc(
      'reserve_meal_photo_analysis_quota',
      { p_user_id: user.id },
    )
    if (quotaError) {
      console.error('Unable to reserve meal analysis quota', { userId: user.id, error: quotaError.message })
      return jsonError('INTERNAL_ERROR', 'Unable to verify usage limit', 500)
    }
    if (quotaReserved !== true) return jsonError('RATE_LIMITED', 'Meal analysis limit reached', 429)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25_000)
    let geminiResponse: Response
    try {
      geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: analysisPrompt(request.description) },
                { inline_data: { mime_type: request.mime_type, data: request.image_base64 } },
              ],
            }],
            generationConfig: geminiGenerationConfig(),
          }),
        },
      )
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return jsonError('PROVIDER_TIMEOUT', 'Meal analysis timed out', 504)
      }
      console.error('Meal analysis provider request failed', { error: error instanceof Error ? error.message : 'Unknown error' })
      return jsonError('ANALYSIS_FAILED', 'Meal analysis failed', 502)
    } finally {
      clearTimeout(timeout)
    }

    if (!geminiResponse.ok) {
      console.error('Meal analysis provider rejected request', { status: geminiResponse.status })
      return jsonError('ANALYSIS_FAILED', 'Meal analysis failed', 502)
    }

    let providerBody: unknown
    try {
      providerBody = await geminiResponse.json()
    } catch {
      return jsonError('ANALYSIS_FAILED', 'Meal analysis failed', 502)
    }
    const text = (providerBody as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> })
      ?.candidates?.[0]?.content?.parts
      ?.map(part => typeof part.text === 'string' ? part.text : '')
      .join('')
    if (!text) return jsonError('ANALYSIS_FAILED', 'Meal analysis failed', 502)

    let rawAnalysis: unknown
    try {
      rawAnalysis = JSON.parse(text)
    } catch {
      return jsonError('ANALYSIS_FAILED', 'Meal analysis failed', 502)
    }
    const analysis = parseMealAnalysis(rawAnalysis)
    if (!analysis) return jsonError('ANALYSIS_FAILED', 'Meal analysis failed', 502)
    return json(analysis)
  } catch (error) {
    console.error('analyze-meal-photo failed', { error: error instanceof Error ? error.message : 'Unknown error' })
    return jsonError('INTERNAL_ERROR', 'Unable to analyze meal photo', 500)
  }
})
