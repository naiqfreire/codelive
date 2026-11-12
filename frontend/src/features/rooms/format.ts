const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
})

/** Formats an ISO 8601 timestamp as `dd/mm/aaaa`, or `''` when it cannot be parsed. */
export function formatRoomDate(isoDate: string): string {
  const date = new Date(isoDate)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return dateFormatter.format(date)
}
