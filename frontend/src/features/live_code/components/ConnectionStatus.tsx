import type { RoomConnectionStatus } from '../useRoomConnection'

type LiveStatus = Exclude<RoomConnectionStatus, 'idle'>

type StatusStyle = {
  label: string
  dot: string
  text: string
}

const STATUS_STYLES: Record<LiveStatus, StatusStyle> = {
  connecting: {
    label: 'Conectando…',
    dot: 'bg-muted-foreground motion-safe:animate-pulse',
    text: 'text-muted-foreground',
  },
  connected: {
    label: 'Conectado',
    dot: 'bg-accent',
    text: 'text-foreground',
  },
  reconnecting: {
    label: 'Reconectando…',
    dot: 'bg-muted-foreground motion-safe:animate-pulse',
    text: 'text-muted-foreground',
  },
  disconnected: {
    label: 'Sem conexão',
    dot: 'bg-destructive',
    text: 'text-destructive',
  },
}

type ConnectionStatusProps = {
  status: LiveStatus
}

/** Live channel status pill; announced politely so it never interrupts typing. */
export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const style = STATUS_STYLES[status]

  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium whitespace-nowrap"
    >
      <span aria-hidden="true" className={['size-2 rounded-full', style.dot].join(' ')} />
      <span className={style.text}>{style.label}</span>
    </span>
  )
}
