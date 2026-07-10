type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const priorities: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const sensitiveKeys = [
  'access_token',
  'refresh_token',
  'id_token',
  'token',
  'password',
  'authorization',
  'apikey',
  'api_key',
]

const loggingEnabled = import.meta.env.MODE !== 'test' && import.meta.env.VITE_LOGGING_ENABLED !== 'false'
const minimumLevel = normalizeLogLevel(
  import.meta.env.VITE_LOG_LEVEL ?? (import.meta.env.DEV ? 'debug' : 'info'),
)

export const logger = {
  debug(message: string, context?: unknown) {
    log('debug', message, context)
  },
  info(message: string, context?: unknown) {
    log('info', message, context)
  },
  warn(message: string, context?: unknown) {
    log('warn', message, context)
  },
  error(message: string, context?: unknown) {
    log('error', message, context)
  },
}

export function installGlobalErrorLogging() {
  window.addEventListener('error', event => {
    logger.error('Unhandled browser error', {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      error: event.error,
    })
  })

  window.addEventListener('unhandledrejection', event => {
    logger.error('Unhandled promise rejection', { reason: event.reason })
  })
}

function normalizeLogLevel(value: string): LogLevel {
  if (value === 'debug' || value === 'info' || value === 'warn' || value === 'error') {
    return value
  }
  return 'info'
}

function log(level: LogLevel, message: string, context?: unknown) {
  if (!loggingEnabled || priorities[level] < priorities[minimumLevel]) return

  const prefix = `[CoachFoska Admin][${level.toUpperCase()}] ${message}`
  const args = context === undefined ? [prefix] : [prefix, redact(context)]

  switch (level) {
    case 'debug':
      console.debug(...args)
      break
    case 'info':
      console.info(...args)
      break
    case 'warn':
      console.warn(...args)
      break
    case 'error':
      console.error(...args)
      break
  }
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[Redacted: depth]'
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    }
  }
  if (Array.isArray(value)) {
    return value.map(item => redact(item, depth + 1))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        isSensitiveKey(key) ? '***' : redact(entry, depth + 1),
      ]),
    )
  }
  if (typeof value === 'string') {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer ***')
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '***')
  }
  return value
}

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase()
  return sensitiveKeys.some(sensitive => normalized.includes(sensitive))
}
