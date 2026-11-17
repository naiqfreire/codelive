import { Button } from '../../../shared/components'
import {
  CONFLICT_ACCEPT_LABEL,
  CONFLICT_DESCRIPTION,
  CONFLICT_KEEP_LABEL,
  CONFLICT_TITLE,
} from '../messages'
import type { RoomConflict } from '../useRoomConnection'

type LatestVersionNoticeProps = {
  message: string | null
}

/**
 * Polite confirmation that the editor received a newer snapshot.
 *
 * The region is always rendered so its height does not collapse; it uses
 * `aria-live` without `role="status"` because `ConnectionStatus` already owns
 * that role in the room header.
 */
export function LatestVersionNotice({ message }: LatestVersionNoticeProps) {
  return (
    <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
      {message ?? ''}
    </p>
  )
}

function formatReceivedAt(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

type ConflictNoticeProps = {
  conflict: RoomConflict
  onAcceptServer: () => void
  onKeepLocal: () => void
}

/**
 * Authoritative-server conflict: the reconnect snapshot differs from unsent
 * local edits. Neither side is discarded until the owner chooses.
 */
export function ConflictNotice({
  conflict,
  onAcceptServer,
  onKeepLocal,
}: ConflictNoticeProps) {
  const receivedAt = formatReceivedAt(conflict.receivedAt)

  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/60 bg-muted p-4"
    >
      <p className="font-medium text-foreground">{CONFLICT_TITLE}</p>
      <p className="mt-1 text-sm text-muted-foreground">{CONFLICT_DESCRIPTION}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {receivedAt
          ? `Versão do servidor recebida às ${receivedAt}.`
          : 'Versão do servidor recebida agora.'}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" onClick={onAcceptServer}>
          {CONFLICT_ACCEPT_LABEL}
        </Button>
        <Button type="button" variant="secondary" onClick={onKeepLocal}>
          {CONFLICT_KEEP_LABEL}
        </Button>
      </div>
    </div>
  )
}
