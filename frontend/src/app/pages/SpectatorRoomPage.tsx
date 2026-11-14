import { EmptyState } from '../../shared/components'
import { CodeEditor, ConnectionStatus, useRoomConnection } from '../../features/live_code'
import type { RoomConnectionState } from '../../features/live_code'
import type { Participant } from '../../features/membership'
import type { RoomDetail } from '../../features/rooms'
import { RoomLayout } from '../layouts/RoomLayout'

type SpectatorRoomPageProps = {
  room?: RoomDetail
  /** Overrides the live hook (tests and future join flow). */
  connection?: RoomConnectionState
  /**
   * Names of the people in the room. The presence frame only carries a count
   * today, so the layout falls back to it while the list is empty.
   */
  participants?: Participant[]
}

const READ_ONLY_NOTICE = 'Você está assistindo. Somente o dono da sala pode editar o código.'

export default function SpectatorRoomPage({
  room,
  connection,
  participants,
}: SpectatorRoomPageProps) {
  // The hook is always called (rules of hooks); it stays idle when the caller
  // already provides a connection state.
  const liveState = useRoomConnection(connection ? null : (room?.id ?? null), {
    initialCode: room?.code ?? '',
  })
  const live = connection ?? liveState

  if (!room) {
    return (
      <section aria-labelledby="spectator-room-heading" className="space-y-6">
        <h1 id="spectator-room-heading" className="font-mono text-3xl font-semibold tracking-tight">
          Sala não encontrada
        </h1>
        <EmptyState
          title="Verifique o código de acesso"
          description="O endereço acessado não corresponde a nenhuma sala ativa. Peça um novo código ao dono da sala."
        />
      </section>
    )
  }

  return (
    <section aria-labelledby="spectator-room-heading" className="space-y-6">
      <RoomLayout
        title="Sala ao vivo"
        headingId="spectator-room-heading"
        accessCode={room.accessCode}
        language={live.language ?? room.language}
        status={room.status}
        readOnly
        readOnlyNotice={READ_ONLY_NOTICE}
        connection={live.status === 'idle' ? null : <ConnectionStatus status={live.status} />}
        participants={participants}
        participantCount={live.participantCount}
      >
        {live.lastError ? (
          <p role="alert" className="mb-2 text-sm text-destructive">
            {live.lastError.message}
          </p>
        ) : null}

        <h2 className="mb-2 text-sm font-medium text-foreground">Código da sala</h2>
        <CodeEditor
          value={live.code}
          language={live.language ?? room.language}
          readOnly
          label="Código da sala"
          className="h-[60vh] lg:h-[70vh]"
        />
      </RoomLayout>
    </section>
  )
}
