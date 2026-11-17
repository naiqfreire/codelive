/** Composition: resolves a joined or anonymous room and owns its live channel. */
import { Link, useLocation, useParams } from 'react-router-dom'
import { Button, EmptyState } from '../../shared/components'
import { useAuth } from '../../features/auth'
import { useRoomConnection } from '../../features/live_code'
import {
  isRoomSummary,
  roomsApi,
  roomsErrorMessage,
  useJoinedRooms,
} from '../../features/rooms'
import type { RoomSummary, RoomsApi } from '../../features/rooms'
import SpectatorRoomPage from '../pages/SpectatorRoomPage'

const LOAD_ERROR_FALLBACK = 'Não foi possível carregar a sala. Tente novamente.'

type ViewLocationState = {
  room?: unknown
}

/**
 * Reads the room carried from the identification step.
 *
 * A spectator without an account has no joined list to fall back on, so this
 * state is their only handle. It is a rendering hint only: the WebSocket
 * authorizes the spectator server-side, and a forged room id simply fails to
 * connect.
 */
function readStateRoom(state: unknown, roomId: string | undefined): RoomSummary | null {
  if (!state || typeof state !== 'object') return null

  const room = (state as ViewLocationState).room

  if (!isRoomSummary(room) || room.id !== roomId) return null

  return room
}

function BackLink({ anonymous }: { anonymous: boolean }) {
  const to = anonymous ? '/rooms/join' : '/rooms/joined'
  const label = anonymous
    ? 'Informar outro código de acesso'
    : 'Voltar para salas que você participou'

  return (
    <Link
      to={to}
      className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
    >
      <span aria-hidden="true">←</span> {label}
    </Link>
  )
}

function LoadingState({ anonymous }: { anonymous: boolean }) {
  return (
    <section aria-labelledby="spectator-room-loading" className="space-y-6">
      <BackLink anonymous={anonymous} />
      <h1 id="spectator-room-loading" className="font-mono text-3xl font-semibold tracking-tight">
        Carregando sala…
      </h1>
      <p role="status" className="text-muted-foreground">
        Buscando os dados da sala.
      </p>
    </section>
  )
}

function ErrorState({
  message,
  onRetry,
  anonymous,
}: {
  message: string
  onRetry: () => void
  anonymous: boolean
}) {
  return (
    <section aria-labelledby="spectator-room-error" className="space-y-6">
      <BackLink anonymous={anonymous} />
      <h1 id="spectator-room-error" className="font-mono text-3xl font-semibold tracking-tight">
        Não foi possível abrir a sala
      </h1>
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-xl border border-destructive/60 bg-muted p-6"
      >
        <p className="text-sm text-foreground">{message}</p>
        <Button type="button" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    </section>
  )
}

/** Anonymous visitors have no joined list, so a missing state asks for the code. */
function AnonymousMissingRoom() {
  return (
    <section aria-labelledby="spectator-room-missing" className="space-y-6">
      <BackLink anonymous />
      <h1 id="spectator-room-missing" className="font-mono text-3xl font-semibold tracking-tight">
        Sala não encontrada
      </h1>
      <EmptyState
        title="Informe o código da sala"
        description="O endereço acessado não carrega os dados da sala. Volte ao código de acesso para entrar novamente."
        action={
          <Link
            to="/rooms/join"
            className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition hover:bg-accent/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
          >
            Informar o código da sala
          </Link>
        }
      />
    </section>
  )
}

export default function SpectatorRoomRoute({ api = roomsApi }: { api?: RoomsApi }) {
  const { roomId } = useParams()
  const location = useLocation()
  const { status, user } = useAuth()
  const isAuthenticated = status === 'authenticated'
  const stateRoom = readStateRoom(location.state, roomId)

  // Reload and direct links resolve the room from the joined list. The query
  // stays disabled for anonymous visitors: they have no joined list at all.
  const roomsQuery = useJoinedRooms(isAuthenticated ? user?.id : undefined, api)
  const joinedRoom = roomsQuery.data?.find((item) => item.id === roomId)

  // The state is the fast path right after entering; for reloads only the
  // joined list can restore the room.
  const room = isAuthenticated ? (stateRoom ?? joinedRoom) : stateRoom

  // Connect only once the room is known: an unknown id must not open a socket.
  const connection = useRoomConnection(room?.id ?? null)

  if (status === 'loading') {
    return <LoadingState anonymous={!isAuthenticated} />
  }

  if (isAuthenticated && !room && roomsQuery.isPending) {
    return <LoadingState anonymous={false} />
  }

  if (isAuthenticated && !room && roomsQuery.isError) {
    return (
      <ErrorState
        anonymous={false}
        message={roomsErrorMessage(roomsQuery.error, LOAD_ERROR_FALLBACK)}
        onRetry={() => {
          void roomsQuery.refetch()
        }}
      />
    )
  }

  if (!room && !isAuthenticated) {
    return <AnonymousMissingRoom />
  }

  return <SpectatorRoomPage room={room ?? undefined} connection={connection} />
}
