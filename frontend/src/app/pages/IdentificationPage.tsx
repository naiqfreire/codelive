import { Link } from 'react-router-dom'
import type { JoinChoice } from '../../features/membership'
import { JoinRoomModal } from '../../features/membership'
import { LANGUAGE_OPTIONS } from '../../features/rooms'
import type { RoomLookup } from '../../features/rooms'

type IdentificationPageProps = {
  room: RoomLookup
  /** True when the visitor has no account and will enter anonymously. */
  anonymousEntry: boolean
  isSubmitting?: boolean
  errorMessage?: string | null
  onJoin: (choice: JoinChoice) => void
  onClose: () => void
}

function languageLabel(room: RoomLookup): string {
  return LANGUAGE_OPTIONS.find((option) => option.value === room.language)?.label ?? room.language
}

/**
 * Step 3 of the spectator flow (RNF03).
 *
 * The route owns the session, the `POST /join` request and the navigation. This
 * page only renders the room identity and the entry modal until the request
 * succeeds.
 */
export default function IdentificationPage({
  room,
  anonymousEntry,
  isSubmitting = false,
  errorMessage = null,
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
      <p className="mt-1 text-sm text-muted-foreground">
        {anonymousEntry
          ? 'Você vai entrar sem conta. Escolha o nickname que aparecerá para a sala.'
          : 'Você vai entrar com sua conta. Escolha o nickname que aparecerá para a sala.'}
      </p>

      <JoinRoomModal
        accessCode={room.accessCode}
        anonymousEntry={anonymousEntry}
        isSubmitting={isSubmitting}
        error={errorMessage}
        onJoin={onJoin}
        onClose={onClose}
      />

      <p className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <Link className="font-medium text-accent underline-offset-4 hover:underline" to="/rooms/join">
          Voltar ao código
        </Link>
        {anonymousEntry ? (
          <Link
            className="font-medium text-accent underline-offset-4 hover:underline"
            to="/login"
          >
            Entrar na sua conta
          </Link>
        ) : (
          <Link
            className="font-medium text-accent underline-offset-4 hover:underline"
            to="/rooms"
          >
            Minhas salas
          </Link>
        )}
      </p>
    </section>
  )
}
