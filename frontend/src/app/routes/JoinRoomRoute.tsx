/** Composition: guards, identifies and enters the room reached by its code. */
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../shared/components'
import { useAuth } from '../../features/auth'
import type { JoinChoice } from '../../features/membership'
import {
  accessCodeErrorMessage,
  CLOSED_ROOM_MESSAGE,
  roomsApi,
} from '../../features/rooms'
import type { RoomLookup, RoomSummary, RoomsApi } from '../../features/rooms'
import IdentificationPage from '../pages/IdentificationPage'

const JOIN_ERROR_FALLBACK = 'Não foi possível entrar na sala. Tente novamente.'

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
  showAccountLink,
}: {
  title: string
  description: string
  room: RoomLookup | null
  showAccountLink: boolean
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
        {showAccountLink ? (
          <Link
            className="font-medium text-accent underline-offset-4 hover:underline"
            to="/rooms"
          >
            Minhas salas
          </Link>
        ) : (
          <Link
            className="font-medium text-accent underline-offset-4 hover:underline"
            to="/login"
          >
            Entrar na sua conta
          </Link>
        )}
      </p>
    </section>
  )
}

function LoadingState() {
  return (
    <section aria-labelledby="join-loading-heading" className="max-w-md space-y-3">
      <h1
        id="join-loading-heading"
        className="font-mono text-3xl font-semibold tracking-tight"
      >
        Identificação
      </h1>
      <p role="status" className="text-muted-foreground">
        Verificando sua sessão…
      </p>
    </section>
  )
}

function SessionErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <section aria-labelledby="join-session-error" className="max-w-md space-y-4">
      <h1
        id="join-session-error"
        className="font-mono text-3xl font-semibold tracking-tight"
      >
        Não foi possível verificar sua sessão
      </h1>
      <p role="alert" className="text-sm text-destructive">
        {message ?? 'Tente novamente.'}
      </p>
      <Button type="button" onClick={onRetry}>
        Tentar novamente
      </Button>
    </section>
  )
}

export default function JoinRoomRoute({ api = roomsApi }: { api?: RoomsApi }) {
  const { roomId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { status, errorMessage, retry } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const room = readRoom(location.state, roomId)
  const isAuthenticated = status === 'authenticated'
  // An unresolved identity must not be guessed: an anonymous join while a
  // valid session exists would create a membership the WebSocket cannot use.
  const identityKnown = status === 'authenticated' || status === 'anonymous'

  if (!room) {
    return (
      <GuardPage
        title="Código necessário"
        description="Entre com o código de acesso da sala para chegar à identificação."
        room={null}
        showAccountLink={isAuthenticated}
      />
    )
  }

  if (room.status === 'closed') {
    return (
      <GuardPage
        title="Sala encerrada"
        description={CLOSED_ROOM_MESSAGE}
        room={room}
        showAccountLink={isAuthenticated}
      />
    )
  }

  if (status === 'loading') return <LoadingState />

  if (status === 'error') {
    return <SessionErrorState message={errorMessage} onRetry={retry} />
  }

  // `identityKnown` is true at this point; kept explicit so TypeScript narrows
  // the payload flag from the same condition the backend will validate.
  const anonymousEntry = !isAuthenticated && identityKnown
  // Captured as a non-null value: the hoisted handler below must not re-check
  // the guard that already returned above.
  const activeRoom: RoomLookup = room

  const handleClose = () => {
    navigate('/rooms/join', { state: { code: activeRoom.accessCode } })
  }

  async function handleJoin(choice: JoinChoice) {
    if (isSubmitting) return

    setError(null)
    setIsSubmitting(true)

    try {
      const joined: RoomSummary = await api.join(activeRoom.id, {
        code: activeRoom.accessCode,
        anonymous: anonymousEntry,
        nickname: choice.nickname,
      })

      if (isAuthenticated) {
        void queryClient.invalidateQueries({ queryKey: ['rooms', 'joined'] })
      }

      navigate(`/rooms/${joined.id}/view`, {
        replace: true,
        state: { room: joined },
      })
    } catch (submitError) {
      setError(accessCodeErrorMessage(submitError, JOIN_ERROR_FALLBACK))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <IdentificationPage
      room={room}
      anonymousEntry={anonymousEntry}
      isSubmitting={isSubmitting}
      errorMessage={error}
      onJoin={(choice) => {
        void handleJoin(choice)
      }}
      onClose={handleClose}
    />
  )
}
