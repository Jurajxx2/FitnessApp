import { logger } from './logger'

const sensitiveSearchParams = ['access_token', 'refresh_token', 'id_token', 'token', 'apikey', 'api_key']

export async function loggingFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const startedAt = performance.now()
  const request = input instanceof Request ? input : null
  const method = (init?.method ?? request?.method ?? 'GET').toUpperCase()
  const url = formatUrl(request?.url ?? input.toString())

  try {
    const response = await globalThis.fetch(input, init)
    const durationMs = Math.round(performance.now() - startedAt)
    const context = { method, url, status: response.status, durationMs }

    if (response.ok) {
      logger.debug('HTTP request completed', context)
    } else {
      logger.warn('HTTP request returned non-OK status', context)
    }

    return response
  } catch (error) {
    logger.error('HTTP request failed', {
      method,
      url,
      durationMs: Math.round(performance.now() - startedAt),
      error,
    })
    throw error
  }
}

function formatUrl(value: string): string {
  const url = new URL(value, window.location.origin)
  sensitiveSearchParams.forEach(param => {
    if (url.searchParams.has(param)) {
      url.searchParams.set(param, '***')
    }
  })
  return `${url.origin}${url.pathname}${url.search}`
}
