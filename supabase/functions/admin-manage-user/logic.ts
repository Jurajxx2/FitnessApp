export const ADMIN_USER_ACTIONS = ['block', 'unblock', 'promote_admin', 'delete'] as const

export type AdminUserAction = typeof ADMIN_USER_ACTIONS[number]

export interface AdminUserRequest {
  action: AdminUserAction
  userId: string
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseAdminUserRequest(body: unknown): AdminUserRequest | null {
  if (typeof body !== 'object' || body === null) return null

  const { action, userId } = body as Record<string, unknown>
  if (
    typeof action !== 'string' ||
    !ADMIN_USER_ACTIONS.includes(action as AdminUserAction) ||
    typeof userId !== 'string' ||
    !uuidPattern.test(userId)
  ) {
    return null
  }

  return { action: action as AdminUserAction, userId }
}
