import { Link } from 'react-router-dom'
import type { JoinChoice } from '../../features/membership'
import { JoinRoomModal } from '../../features/membership'
import { LANGUAGE_OPTIONS } from '../../features/rooms'
import type { RoomLookup } from '../../features/rooms'

type IdentificationPageProps = {
  room: RoomLookup
  choice: JoinChoice | null
  onJoin: (choice: JoinChoice) => void
  onClose: () => void
}

function languageLabel(room: RoomLookup): string {
  return LANGUAGE_OPTIONS.find((option) => option.value === room.language)?.label ?? room.language
}

/**
 * Step 3 of the spectator flow (RNF03).
 *
 * This delivery stops at the identification shell: the joined choice is
 * recorded, but the `POST /join` request belongs to the entry task. The route
 * owns the room resolved by the access-code step.
 */
export default function IdentificationPage({
  room,
  choice,
  onJoin,
  onClose,
}: IdentificationPageProps) {
  return (
    <section aria-labelledby="identification-heading" className="max-w-md">
      <p className="text-xs font-medium tracking-[0.2em] text-accent uppercase">Passo 3 de 4</p>
      <h1
        id="identification-heading"
        tabIndex={-1}
        className="mt-2 font-mono text-3xl font-semibold tracking-tight focus-visible:outline-none"
      >
        Identificação
      </h1>
      <p className="mt-2 text-muted-foreground">
        Sala <span className="font-mono text-foreground">{room.accessCode}</span> ·{' '}
        {languageLabel(room)}
      </p>

      {choice ? (
        <div
          role="status"
          className="mt-6 rounded-lg border border-border bg-surface p-4 text-sm"
        >
          <p className="font-medium text-foreground">
            Identificação registrada: {choice.nickname}
          </p>
          <p className="mt-1 text-muted-foreground">
            {choice.anonymous ? 'Entrada sem conta' : 'Entrada com conta'} · A entrada na sala
            será concluída na próxima etapa do fluxo.
          </p>
        </div>
      ) : null}

      {!choice ? (
        <JoinRoomModal accessCode={room.accessCode} onJoin={onJoin} onClose={onClose} />
      ) : null}

      <p className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <Link className="font-medium text-accent underline-offset-4 hover:underline" to="/rooms/join">
          Voltar ao código
        </Link>
        <Link className="font-medium text-accent underline-offset-4 hover:underline" to="/rooms">
          Minhas salas
        </Link>
      </p>
    </section>
  )
}
