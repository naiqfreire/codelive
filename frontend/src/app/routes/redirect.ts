/**
 * Destination after a successful login or registration.
 *
 * `ProtectedRoute` stores the intended path in `location.state.from`. Only
 * internal absolute paths are accepted, so a crafted state can never turn the
 * form into an open redirect.
 */
export const DEFAULT_REDIRECT = '/rooms'

export function resolveRedirectTarget(state: unknown, fallback: string = DEFAULT_REDIRECT): string {
  if (state && typeof state === 'object') {
    const from = (state as { from?: unknown }).from
    if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')) {
      return from
    }
  }
  return fallback
}
