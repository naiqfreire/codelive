import { useId } from 'react'

import type { Participant } from '../types'

type ParticipantListProps = {
  /** Names of the people in the room. Empty while the API does not expose them. */
  participants?: Participant[]
  /** Live count from the WebSocket, used while the names are not available. */
  count?: number
}

const NOBODY_CONNECTED = 'Nenhum participante conectado ainda'

function countLabel(count: number) {
  if (count === 0) {
    return NOBODY_CONNECTED
  }

  return count === 1 ? '1 participante conectado' : `${count} participantes conectados`
}

/**
 * Participants panel of the room layout.
 *
 * The presence frame only carries a count today, so the list falls back to the
 * live count when no names are provided. When the names arrive, the list wins:
 * showing both would let "3 participantes conectados" contradict a list of two.
 */
export function ParticipantList({ participants = [], count = 0 }: ParticipantListProps) {
  const headingId = useId()
  const hasNames = participants.length > 0

  return (
    <aside
      aria-labelledby={headingId}
      className="rounded-xl border border-border bg-surface p-4"
    >
      <h2 id={headingId} className="text-sm font-medium text-foreground">
        Participantes
      </h2>

      {hasNames ? (
        <ul className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-1">
          {participants.map((participant) => (
            <li
              key={`${participant.nickname}-${participant.role}`}
              className="flex min-w-0 items-center justify-between gap-2 text-sm"
            >
              <span className="truncate text-foreground">{participant.nickname}</span>
              {participant.role === 'owner' ? (
                <span className="shrink-0 text-xs text-muted-foreground">(dono)</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">
          {countLabel(count)}
        </p>
      )}
    </aside>
  )
}
