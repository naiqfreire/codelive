import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth'
import { Button } from '../../shared/components'

const NAV_LINK_CLASSES =
  'inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none'

const LOGOUT_ERROR = 'Não foi possível sair. Tente novamente.'

export function AppShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const isJoinSection = pathname === '/rooms/join' || pathname.endsWith('/join')
  const isRoomsSection = pathname.startsWith('/rooms') && !isJoinSection

  async function handleLogout() {
    setLogoutError(null)
    setIsLoggingOut(true)

    try {
      await logout()
      navigate('/login', { replace: true })
    } catch {
      setLogoutError(LOGOUT_ERROR)
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-surface/60">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link
            to="/rooms"
            className="font-mono text-sm tracking-[0.3em] text-accent uppercase focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
          >
            CodeLive
          </Link>

          <nav aria-label="Navegação principal" className="flex flex-wrap items-center gap-2">
            <Link
              to="/rooms"
              aria-current={isRoomsSection ? 'page' : undefined}
              className={[
                NAV_LINK_CLASSES,
                isRoomsSection ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              Minhas salas
            </Link>
            <Link
              to="/rooms/join"
              aria-current={isJoinSection ? 'page' : undefined}
              className={[
                NAV_LINK_CLASSES,
                isJoinSection
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              Entrar com código
            </Link>
            {user ? (
              <span className="max-w-xs truncate px-3 text-sm text-muted-foreground">
                Olá, {user.name}
              </span>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              isLoading={isLoggingOut}
              onClick={() => {
                void handleLogout()
              }}
            >
              {isLoggingOut ? 'Saindo…' : 'Sair'}
            </Button>
          </nav>
        </div>
      </header>

      {logoutError ? (
        <p role="alert" className="mx-auto w-full max-w-6xl px-6 pt-4 text-sm text-destructive">
          {logoutError}
        </p>
      ) : null}

      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  )
}
