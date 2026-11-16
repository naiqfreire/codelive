import { Link } from 'react-router-dom'
import { Button, EmptyState } from '../../shared/components'
import { JoinedRoomCard, RoomListTabs } from '../../features/rooms'
import type { JoinedRoom } from '../../features/rooms'

const LOAD_ERROR_FALLBACK = 'Não foi possível carregar as salas que você participou. Tente novamente.'

const ACTION_LINK_CLASSES = [
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 font-medium text-foreground transition',
  'hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
].join(' ')

type JoinedRoomsPageProps = {
  rooms: JoinedRoom[]
  isLoading?: boolean
  errorMessage?: string | null
  isSessionExpired?: boolean
  onRetry?: () => void
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`
}

/**
 * "Salas que participei" screen (RF04). Presentational: the route component
 * owns auth, the query and the cache. Only viewer memberships reach this page,
 * newest join first.
 */
export default function JoinedRoomsPage({
  rooms,
  isLoading = false,
  errorMessage = null,
  isSessionExpired = false,
  onRetry,
}: JoinedRoomsPageProps) {
  const openCount = rooms.filter((room) => room.status === 'active').length
  const closedCount = rooms.length - openCount
  const hasRooms = rooms.length > 0
  const showFullError = Boolean(errorMessage) && !hasRooms && !isLoading
  const showStaleBanner = Boolean(errorMessage) && hasRooms

  return (
    <section aria-labelledby="joined-rooms-heading">
      <RoomListTabs />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            id="joined-rooms-heading"
            tabIndex={-1}
            className="font-mono text-3xl font-semibold tracking-tight focus-visible:outline-none"
          >
            Salas que participei
          </h1>
          <p className="mt-2 text-muted-foreground">
            Salas em que você entrou como espectador. O acesso rápido abre a sala em modo somente
            leitura.
          </p>
        </div>
        <Link to="/rooms/join" className={ACTION_LINK_CLASSES}>
          Entrar com código
        </Link>
      </header>

      {showStaleBanner ? (
        <div
          role="alert"
          className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/60 bg-muted px-4 py-3"
        >
          <p className="text-sm text-foreground">{errorMessage}</p>
          {onRetry ? (
            <Button type="button" variant="secondary" className="px-4" onClick={onRetry}>
              Tentar novamente
            </Button>
          ) : null}
        </div>
      ) : null}

      {isLoading && !hasRooms ? (
        <p role="status" className="mt-8 text-muted-foreground">
          Carregando salas…
        </p>
      ) : showFullError ? (
        <div
          role="alert"
          className="mt-8 flex flex-col items-start gap-3 rounded-xl border border-destructive/60 bg-muted p-6"
        >
          <p className="text-sm text-foreground">{errorMessage ?? LOAD_ERROR_FALLBACK}</p>
          {onRetry ? (
            <Button type="button" onClick={onRetry}>
              {isSessionExpired ? 'Entrar novamente' : 'Tentar novamente'}
            </Button>
          ) : null}
        </div>
      ) : !hasRooms ? (
        <div className="mt-8">
          <EmptyState
            title="Você ainda não entrou em nenhuma sala"
            description="Use o código de acesso que o dono compartilhou para assistir à sala ao vivo."
            action={
              <Link to="/rooms/join" className={ACTION_LINK_CLASSES}>
                Entrar com código
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted-foreground">
            {countLabel(openCount, 'aberta', 'abertas')} ·{' '}
            {countLabel(closedCount, 'encerrada', 'encerradas')}
          </p>
          <ul className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <li key={room.id}>
                <JoinedRoomCard room={room} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
