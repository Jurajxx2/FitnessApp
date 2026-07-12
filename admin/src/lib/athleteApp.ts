const allowedProtocols = new Set(['http:', 'https:'])

export function getAthleteAppUrl(): string | null {
  const configuredUrl = import.meta.env.VITE_ATHLETE_APP_URL?.trim()
  if (!configuredUrl) return null

  try {
    const url = new URL(configuredUrl)
    return allowedProtocols.has(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}
