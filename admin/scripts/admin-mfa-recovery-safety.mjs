export function assertDeletionAllowed({ authUser, profile, factors, userId, factorId, confirmedUserId }) {
  if (!authUser) throw new Error('Refusing recovery: the canonical Auth user was not found.')
  if (authUser.id !== userId) throw new Error('Refusing recovery: the canonical Auth user ID does not match the target.')
  if (!profile?.is_admin) throw new Error('Refusing recovery: the target profile is not an admin.')
  if (confirmedUserId !== userId) {
    throw new Error('Refusing deletion: MFA_RECOVERY_CONFIRMED_USER_ID must exactly match the target user ID.')
  }
  if (!factors.some(factor => factor.id === factorId)) {
    throw new Error('Refusing deletion: factor ID is not attached to the target user.')
  }
}
