/**
 * Gate for private routes: nothing renders until the server confirms the
 * session, so a reload never flashes protected content.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Button } from '../../shared/components'
import { useAuth } from './context'

function LoadingScreen() {
  return (
    <div
      role="status"
      className="flex min-h-screen items-center justify-center text-muted-foreground"
    >
      Carregando…
    </div>
  )
}

export function ProtectedRoute() {
  const { status, errorMessage, retry } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <LoadingScreen />

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <section
          aria-labelledby="auth-error-heading"
          className="w-full max-w-md rounded-xl border border-border bg-surface p-6"
        >
          <h1 id="auth-error-heading" className="font-mono text-xl font-semibold">
            Não foi possível carregar sua sessão
          </h1>
          <p role="alert" className="mt-3 text-sm text-destructive">
            {errorMessage ?? 'Tente novamente.'}
          </p>
          <Button type="button" className="mt-6" onClick={retry}>
            Tentar novamente
          </Button>
        </section>
      </div>
    )
  }

  if (status === 'anonymous') {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    )
  }

  return <Outlet />
}
