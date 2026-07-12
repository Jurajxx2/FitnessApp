import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAthleteAppUrl } from './athleteApp'

describe('getAthleteAppUrl', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('returns a configured HTTP(S) athlete app URL', () => {
    vi.stubEnv('VITE_ATHLETE_APP_URL', 'https://athlete.example.com/nutrition')

    expect(getAthleteAppUrl()).toBe('https://athlete.example.com/nutrition')
  })

  it('does not return an unsafe or missing URL', () => {
    vi.stubEnv('VITE_ATHLETE_APP_URL', 'javascript:alert(1)')
    expect(getAthleteAppUrl()).toBeNull()

    vi.stubEnv('VITE_ATHLETE_APP_URL', '')
    expect(getAthleteAppUrl()).toBeNull()
  })
})
