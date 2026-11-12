type StatusBadgeProps = {
  status: 'active' | 'closed'
}

const LABELS = {
  active: 'Aberta',
  closed: 'Encerrada',
} as const

export function StatusBadge({ status }: StatusBadgeProps) {
  const isActive = status === 'active'

  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap',
        isActive ? 'bg-muted text-foreground' : 'border border-border text-muted-foreground',
      ].join(' ')}
    >
      {isActive ? <span aria-hidden="true" className="size-2 rounded-full bg-accent" /> : null}
      {LABELS[status]}
    </span>
  )
}
