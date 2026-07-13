export interface UserContextProfile {
  full_name: string | null
  email: string
}

export function getUserContextReturn(
  userId: string | null,
  profile: UserContextProfile | undefined,
  fallbackTo: string,
  fallbackLabel: string,
) {
  if (!userId) return { to: fallbackTo, label: fallbackLabel }
  return {
    to: `/admin/users/${userId}`,
    label: `Back to ${profile?.full_name ?? profile?.email ?? 'user profile'}`,
  }
}

export function appendUserContext(path: string, userId: string | null): string {
  return userId ? `${path}?user=${encodeURIComponent(userId)}` : path
}
