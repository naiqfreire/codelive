/**
 * Gate for public routes: an authenticated visitor has no reason to see the
 * login or registration form again.
 */
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './context'

export function GuestRoute() {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <div
        role="status"
        className="flex min-h-screen items-center justify-center text-muted-foreground"
      >
        Carregando…
      </div>
    )
  }

  if (status === 'authenticated') {
    return <Navigate to="/rooms" replace />
  }

  // `error` keeps the public page available: logging in may still work.
  return <Outlet />
}
