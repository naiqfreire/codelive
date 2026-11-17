/** Composition: resolves the owner's room and owns its live channel (#42). */
import { Link, useParams } from 'react-router-dom'
import { Button } from '../../shared/components'
import { useAuth } from '../../features/auth'
import { useRoomConnection } from '../../features/live_code'
import { roomsApi, roomsErrorMessage, useMyRooms } from '../../features/rooms'
import type { RoomsApi } from '../../features/rooms'
import { VersionHistory } from '../../features/versions'
import OwnerRoomPage from '../pages/OwnerRoomPage'

const LOAD_ERROR_FALLBACK = 'Não foi possível carregar a sala. Tente novamente.'

function BackLink() {
  return (
    <Link
      to="/rooms"
      className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
    >
      <span aria-hidden="true">←</span> Voltar para suas salas
    </Link>
  )
}

function LoadingState() {
  return (
    <section aria-labelledby="owner-room-loading" className="space-y-6">
      <BackLink />
      <h1 id="owner-room-loading" className="font-mono text-3xl font-semibold tracking-tight">
        Carregando sala…
      </h1>
      <p role="status" className="text-muted-foreground">
        Buscando os dados da sala.
      </p>
    </section>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section aria-labelledby="owner-room-error" className="space-y-6">
      <BackLink />
      <h1 id="owner-room-error" className="font-mono text-3xl font-semibold tracking-tight">
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

export default function OwnerRoomRoute({ api = roomsApi }: { api?: RoomsApi }) {
  const { roomId } = useParams()
  const { user } = useAuth()

  // A reload or deep link has no in-memory room, so the list is the authority.
  const roomsQuery = useMyRooms(user?.id, api)
  const room = roomsQuery.data?.find((item) => item.id === roomId)

  // Connect only once the room is known: an unknown id must not open a socket.
  const connection = useRoomConnection(room?.id ?? null)

  // `isPending` also covers the moment before the session is known; waiting is
  // safer than flashing "not found" and then replacing it with the room.
  if (roomsQuery.isPending) {
    return <LoadingState />
  }

  if (roomsQuery.isError) {
    return (
      <ErrorState
        message={roomsErrorMessage(roomsQuery.error, LOAD_ERROR_FALLBACK)}
        onRetry={() => {
          void roomsQuery.refetch()
        }}
      />
    )
  }

  return (
    <OwnerRoomPage
      room={room}
      connection={connection}
      renderVersionHistory={
        room
          ? (onRestored) => (
              <VersionHistory roomId={room.id} roomStatus={room.status} onRestored={onRestored} />
            )
          : undefined
      }
    />
  )
}
