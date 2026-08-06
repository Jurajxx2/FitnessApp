import { useCallback, useEffect, useRef } from 'react'
import { useBlocker, type BlockerFunction } from 'react-router-dom'

/**
 * Guards a screen with unsaved work against both in-app navigation (via the
 * data router's useBlocker) and browser close/reload (via beforeunload).
 *
 * `isDirty` is read through a ref inside the blocker's decision function
 * rather than closed over directly. react-router only re-registers that
 * function when its identity changes (on an effect, i.e. after a render has
 * committed), but a deliberate-exit navigation can fire from an async
 * mutation callback with no guaranteed render in between the moment the
 * caller clears its dirty state and the moment navigate() runs. Reading a
 * ref keeps the decision correct even then, since the ref reflects whatever
 * the caller's most recent render computed for `isDirty`, independent of
 * whether react-router has re-registered the callback since.
 *
 * That said, this ref is only ever refreshed on a render of the *calling*
 * component (the assignment above runs as part of this hook being called,
 * which only happens when the caller renders). A caller that flips its own
 * "just saved"/"exiting" ref and then, in the same synchronous burst of
 * microtasks, calls navigate() from inside a fast-resolving mutation's
 * onSuccess can reach navigate() before any such render occurs — verified
 * empirically on LogMeal/CreateWorkout/Session. Callers in that situation
 * should force one render with `flushSync` right after flipping their ref
 * (see those three files for the pattern) so this hook is guaranteed to see
 * the fresh value before the navigation it must not block.
 */
export function useUnsavedChangesGuard(isDirty: boolean): {
  blocked: boolean
  confirmLeave: () => void
  cancelLeave: () => void
} {
  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty

  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      isDirtyRef.current && currentLocation.pathname !== nextLocation.pathname,
    [],
  )
  const blocker = useBlocker(shouldBlock)

  useEffect(() => {
    if (!isDirty) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  const confirmLeave = useCallback(() => {
    if (blocker.state === 'blocked') blocker.proceed()
  }, [blocker])

  const cancelLeave = useCallback(() => {
    if (blocker.state === 'blocked') blocker.reset()
  }, [blocker])

  return {
    blocked: blocker.state === 'blocked',
    confirmLeave,
    cancelLeave,
  }
}
