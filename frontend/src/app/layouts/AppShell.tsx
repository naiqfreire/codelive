import { Link, Outlet, useLocation } from 'react-router-dom'

const NAV_LINK_CLASSES =
  'inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none'

const FUTURE_ITEM_CLASSES =
  'inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground/60'

export function AppShell() {
  const { pathname } = useLocation()
  const isRoomsSection = pathname.startsWith('/rooms')

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
            <span
              aria-disabled="true"
              title="Disponível depois da integração com a API"
              className={FUTURE_ITEM_CLASSES}
            >
              Entrar com código
            </span>
            <span
              aria-disabled="true"
              title="Disponível depois da integração com a API"
              className={FUTURE_ITEM_CLASSES}
            >
              Sair
            </span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  )
}
