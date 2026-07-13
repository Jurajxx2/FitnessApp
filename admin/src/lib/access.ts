import type { AccessMode } from '../types/database'

export type AccessProfile = { access_mode?: AccessMode | null }

export function canAccessNutrition(profile: AccessProfile | null | undefined): boolean {
  return !profile?.access_mode || profile.access_mode === 'both' || profile.access_mode === 'nutrition'
}

export function canAccessActivity(profile: AccessProfile | null | undefined): boolean {
  return !profile?.access_mode || profile.access_mode === 'both' || profile.access_mode === 'activity'
}

export function athleteHomePath(profile: AccessProfile | null | undefined): '/nutrition' | '/activity' {
  return canAccessNutrition(profile) ? '/nutrition' : '/activity'
}
