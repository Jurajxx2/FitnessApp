import type { Factor } from '@supabase/supabase-js'

export function safeAdminReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/admin') || value.startsWith('//')) return '/admin'
  return value
}

export function verifiedTotpFactors(factors: Factor[] | null | undefined): Factor[] {
  return (factors ?? []).filter(factor => factor.factor_type === 'totp' && factor.status === 'verified')
}

export function qrCodeDataUrl(qrCode: string): string {
  return qrCode.startsWith('data:')
    ? qrCode
    : `data:image/svg+xml;utf-8,${encodeURIComponent(qrCode)}`
}
