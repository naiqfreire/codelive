/** Composition: guards the identification step reached after the access code. */
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { JoinChoice } from '../../features/membership'
import { CLOSED_ROOM_MESSAGE } from '../../features/rooms'
import type { RoomLookup } from '../../features/rooms'
import IdentificationPage from '../pages/IdentificationPage'

type JoinLocationState = {
  room?: unknown
}

function isRoomLookup(value: unknown): value is RoomLookup {
  if (!value || typeof value !== 'object') return false

  const room = value as Record<string, unknown>

  return (
    typeof room.id === 'string' &&
    typeof room.accessCode === 'string' &&
    (room.language === 'python' ||
      room.language === 'java' ||
      room.language === 'c' ||
      room.language === 'php' ||
      room.language === 'javascript') &&
    (room.status === 'active' || room.status === 'closed') &&
    typeof room.createdAt === 'string' &&
    typeof room.ownerId === 'string' &&
    typeof room.updatedAt === 'string'
  )
}

/** Rejects a direct URL: the room can only come from the access-code step. */
function readRoom(state: unknown, roomId: string | undefined): RoomLookup | null {
  if (!state || typeof state !== 'object') return null

  const room = (state as JoinLocationState).room

  if (!isRoomLookup(room) || room.id !== roomId) return null

  return room
}

function GuardPage({
  title,
  description,
  room,
}: {
  title: string
  description: string
  room: RoomLookup | null
}) {
  return (
    <section aria-labelledby="join-guard-heading" className="max-w-md">
      <h1
        id="join-guard-heading"
        tabIndex={-1}
        className="font-mono text-3xl font-semibold tracking-tight focus-visible:outline-none"
      >
        {title}
      </h1>
      <p role="alert" className="mt-2 text-muted-foreground">
        {description}
      </p>
      <p className="mt-6 flex flex-wrap gap-4 text-sm">
        <Link
          className="font-medium text-accent underline-offset-4 hover:underline"
          to="/rooms/join"
          state={room ? { code: room.accessCode } : undefined}
        >
          Informar outro código
        </Link>
        <Link
          className="font-medium text-accent underline-offset-4 hover:underline"
          to="/rooms"
        >
          Minhas salas
        </Link>
      </p>
    </section>
  )
}

export default function JoinRoomRoute() {
  const { roomId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [choice, setChoice] = useState<JoinChoice | null>(null)

  const room = readRoom(location.state, roomId)

  if (!room) {
    return (
      <GuardPage
        title="Código necessário"
        description="Entre com o código de acesso da sala para chegar à identificação."
        room={null}
      />
    )
  }

  if (room.status === 'closed') {
    return <GuardPage title="Sala encerrada" description={CLOSED_ROOM_MESSAGE} room={room} />
  }

  const handleClose = () => {
    navigate('/rooms/join', { state: { code: room.accessCode } })
  }

  return (
    <IdentificationPage
      room={room}
      choice={choice}
      onJoin={setChoice}
      onClose={handleClose}
    />
  )
}
