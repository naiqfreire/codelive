import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, StatusBadge } from '../../../shared/components'
import { COPIED_MESSAGE, COPY_FAILURE_MESSAGE, copyText } from '../clipboard'
import { formatRoomDate } from '../format'
import { LANGUAGE_OPTIONS } from '../languages'
import type { RoomSummary } from '../types'

type RoomCardProps = {
  room: RoomSummary
  href: string
  onClose?: (room: RoomSummary) => void
  onRegenerateCode?: (room: RoomSummary) => void
}

const LINK_CLASSES = [
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 font-medium text-foreground transition',
  'hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
].join(' ')

export function RoomCard({ room, href, onClose, onRegenerateCode }: RoomCardProps) {
  const [feedback, setFeedback] = useState('')
  const languageLabel =
    LANGUAGE_OPTIONS.find((option) => option.value === room.language)?.label ?? room.language
  const createdDate = formatRoomDate(room.createdAt)
  const isActive = room.status === 'active'

  async function handleCopy() {
    setFeedback((await copyText(room.accessCode)) ? COPIED_MESSAGE : COPY_FAILURE_MESSAGE)
  }

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="-mr-[0.3em] font-mono text-2xl font-semibold tracking-[0.3em] select-all">
          {room.accessCode}
        </h2>
        <StatusBadge status={room.status} />
      </div>

      <p className="text-sm text-muted-foreground">
        {languageLabel}
        {createdDate ? ` · criada em ${createdDate}` : null}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Link to={href} className={LINK_CLASSES}>
          Abrir sala<span className="sr-only"> {room.accessCode}</span>
          <span aria-hidden="true">→</span>
        </Link>

        <Button type="button" variant="secondary" className="px-4" onClick={() => void handleCopy()}>
          Copiar<span className="sr-only"> código {room.accessCode}</span>
        </Button>

        {isActive && onRegenerateCode ? (
          <Button
            type="button"
            variant="secondary"
            className="px-4"
            onClick={() => onRegenerateCode(room)}
          >
            Regenerar<span className="sr-only"> código {room.accessCode}</span>
          </Button>
        ) : null}

        {isActive && onClose ? (
          <Button type="button" variant="danger" className="px-4" onClick={() => onClose(room)}>
            Encerrar<span className="sr-only"> sala {room.accessCode}</span>
          </Button>
        ) : null}
      </div>

      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {feedback}
      </p>
    </article>
  )
}