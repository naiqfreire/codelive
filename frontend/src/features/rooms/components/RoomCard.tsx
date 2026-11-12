import { Link } from 'react-router-dom'
import { StatusBadge } from '../../../shared/components'
import { formatRoomDate } from '../format'
import { LANGUAGE_OPTIONS } from '../languages'
import type { RoomSummary } from '../types'

type RoomCardProps = {
  room: RoomSummary
  href: string
}

export function RoomCard({ room, href }: RoomCardProps) {
  const languageLabel =
    LANGUAGE_OPTIONS.find((option) => option.value === room.language)?.label ?? room.language
  const createdDate = formatRoomDate(room.createdAt)

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="-mr-[0.3em] font-mono text-2xl font-semibold tracking-[0.3em]">
          {room.accessCode}
        </h2>
        <StatusBadge status={room.status} />
      </div>

      <p className="text-sm text-muted-foreground">
        {languageLabel}
        {createdDate ? ` · criada em ${createdDate}` : null}
      </p>

      <Link
        to={href}
        className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-lg border border-border px-4 font-medium text-foreground transition hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
      >
        Abrir sala<span className="sr-only"> {room.accessCode}</span>
        <span aria-hidden="true">→</span>
      </Link>
    </article>
  )
}
