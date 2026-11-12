import { EmptyState, StatusBadge } from '../../shared/components'
import { CodeEditor, ConnectionStatus, useRoomConnection } from '../../features/live_code'
import type { RoomConnectionState } from '../../features/live_code'
import type { RoomDetail } from '../../features/rooms'

type SpectatorRoomPageProps = {
  room?: RoomDetail
  /** Overrides the live hook (tests and future join flow). */
  connection?: RoomConnectionState
}

const READ_ONLY_NOTICE = 'Você está assistindo. Somente o dono da sala pode editar o código.'

function participantLabel(count: number) {
  if (count === 0) {
    return 'Nenhum participante conectado ainda'
  }

  return count === 1 ? '1 participante conectado' : `${count} participantes conectados`
}

export default function SpectatorRoomPage({ room, connection }: SpectatorRoomPageProps) {
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
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1
            id="spectator-room-heading"
            className="font-mono text-3xl font-semibold tracking-tight"
          >
            Sala ao vivo
          </h1>
          <StatusBadge status={room.status} />
          {live.status === 'idle' ? null : <ConnectionStatus status={live.status} />}
        </div>

        <p className="text-muted-foreground">{READ_ONLY_NOTICE}</p>

        <p aria-live="polite" className="text-sm text-muted-foreground">
          {participantLabel(live.participantCount)}
        </p>
      </header>

      {live.lastError ? (
        <p role="alert" className="text-sm text-destructive">
          {live.lastError.message}
        </p>
      ) : null}

      <div>
        <h2 className="mb-2 text-sm font-medium text-foreground">Código da sala</h2>
        <CodeEditor
          value={live.code}
          language={live.language ?? room.language}
          readOnly
          label="Código da sala"
          className="h-[60vh]"
        />
      </div>
    </section>
  )
}
