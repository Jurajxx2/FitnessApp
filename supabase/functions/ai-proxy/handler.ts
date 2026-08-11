import {
  buildAnthropicBody,
  MAX_BODY_BYTES,
  MAX_TOKENS,
  parseProxyRequest,
} from './logic.ts'

export interface AiProfile {
  isBlocked: boolean
  aiAccessEnabled: boolean
}

export interface AiProxyServices {
  getProfile(userId: string): Promise<AiProfile | null>
  reserveQuota(userId: string, inputChars: number, maxOutputTokens: number): Promise<string | null>
  recordQuotaOutcome(
    reservationId: string,
    status: 'upstream_accepted' | 'upstream_failed',
    upstreamStatus?: number,
  ): Promise<void>
  callUpstream(body: Record<string, unknown>): Promise<Response>
}

export interface AiProxyHandlerDependencies {
  aiConfigured: boolean
  authenticate(authorization: string): Promise<string | null>
  createPrivilegedServices(): AiProxyServices
  log(level: 'info' | 'error', event: string, fields: Record<string, unknown>): void
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonError(code: string, status: number, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...headers },
  })
}

type BoundedBodyResult =
  | { status: 'ok'; text: string }
  | { status: 'too_large' }
  | { status: 'invalid' }

async function readBoundedBody(request: Request): Promise<BoundedBodyResult> {
  if (!request.body) return { status: 'ok', text: '' }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel('payload too large')
        return { status: 'too_large' }
      }
      chunks.push(value)
    }

    const body = new Uint8Array(totalBytes)
    let offset = 0
    for (const chunk of chunks) {
      body.set(chunk, offset)
      offset += chunk.byteLength
    }
    return { status: 'ok', text: new TextDecoder('utf-8', { fatal: true }).decode(body) }
  } catch {
    return { status: 'invalid' }
  } finally {
    reader.releaseLock()
  }
}

export function createAiProxyHandler(dependencies: AiProxyHandlerDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
    if (request.method !== 'POST') return jsonError('METHOD_NOT_ALLOWED', 405, { Allow: 'POST, OPTIONS' })

    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) return jsonError('UNAUTHORIZED', 401)

    const userId = await dependencies.authenticate(authorization)
    if (!userId) return jsonError('UNAUTHORIZED', 401)
    if (!dependencies.aiConfigured) {
      dependencies.log('error', 'ai_proxy_configuration_error', { code: 'UPSTREAM_NOT_CONFIGURED' })
      return jsonError('NOT_CONFIGURED', 503)
    }

    // No service-role client is created until Auth has validated the session.
    let services: AiProxyServices
    try {
      services = dependencies.createPrivilegedServices()
    } catch {
      dependencies.log('error', 'ai_proxy_configuration_error', { code: 'SERVER_CONFIGURATION_INVALID' })
      return jsonError('NOT_CONFIGURED', 503)
    }
    let profile: AiProfile | null
    try {
      profile = await services.getProfile(userId)
    } catch {
      dependencies.log('error', 'ai_proxy_profile_error', { userId, code: 'PROFILE_QUERY_FAILED' })
      return jsonError('AUTHORIZATION_UNAVAILABLE', 503)
    }
    if (!profile || profile.isBlocked || !profile.aiAccessEnabled) {
      return jsonError('AI_ACCESS_DENIED', 403)
    }

    const contentLength = Number(request.headers.get('Content-Length') ?? '0')
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return jsonError('PAYLOAD_TOO_LARGE', 413)
    }

    const boundedBody = await readBoundedBody(request)
    if (boundedBody.status === 'too_large') return jsonError('PAYLOAD_TOO_LARGE', 413)
    if (boundedBody.status === 'invalid') return jsonError('INVALID_BODY', 400)
    const rawBody = boundedBody.text

    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(rawBody)
    } catch {
      return jsonError('INVALID_BODY', 400)
    }
    const parsed = parseProxyRequest(parsedJson)
    if (!parsed) return jsonError('INVALID_BODY', 400)

    let reservationId: string | null
    try {
      reservationId = await services.reserveQuota(userId, parsed.inputChars, MAX_TOKENS)
    } catch {
      dependencies.log('error', 'ai_proxy_quota_error', { userId, code: 'RESERVATION_FAILED' })
      return jsonError('QUOTA_UNAVAILABLE', 503)
    }
    if (!reservationId) return jsonError('RATE_LIMITED', 429, { 'Retry-After': '60' })

    let upstreamResponse: Response
    try {
      upstreamResponse = await services.callUpstream(buildAnthropicBody(parsed))
    } catch {
      try {
        await services.recordQuotaOutcome(reservationId, 'upstream_failed')
      } catch {
        dependencies.log('error', 'ai_proxy_quota_error', {
          userId,
          requestId: reservationId,
          code: 'OUTCOME_RECORD_FAILED',
        })
      }
      dependencies.log('error', 'ai_proxy_upstream_failed', { userId, requestId: reservationId })
      return jsonError('UPSTREAM_FAILED', 502)
    }

    if (!upstreamResponse.ok || !upstreamResponse.body) {
      try {
        await services.recordQuotaOutcome(reservationId, 'upstream_failed', upstreamResponse.status)
      } catch {
        dependencies.log('error', 'ai_proxy_quota_error', {
          userId,
          requestId: reservationId,
          code: 'OUTCOME_RECORD_FAILED',
        })
      }
      dependencies.log('error', 'ai_proxy_upstream_failed', {
        userId,
        requestId: reservationId,
        upstreamStatus: upstreamResponse.status,
      })
      return jsonError('UPSTREAM_FAILED', 502)
    }

    try {
      await services.recordQuotaOutcome(reservationId, 'upstream_accepted', upstreamResponse.status)
    } catch {
      dependencies.log('error', 'ai_proxy_quota_error', {
        userId,
        requestId: reservationId,
        code: 'OUTCOME_RECORD_FAILED',
      })
    }
    dependencies.log('info', 'ai_proxy_request_accepted', {
      userId,
      requestId: reservationId,
      inputChars: parsed.inputChars,
      reservedMaxTokens: MAX_TOKENS,
    })
    return new Response(upstreamResponse.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }
}
