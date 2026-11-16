import type { CodeVersion } from './types'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
})

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZone: 'America/Sao_Paulo',
})

/**
 * Formats an ISO 8601 timestamp as `dd/mm/aaaa às HH:mm:ss`, or `''` when it
 * cannot be parsed. Mirrors `rooms/format.ts`: the product timezone is fixed so
 * two people in the room read the same version time.
 */
export function formatVersionDateTime(isoDate: string): string {
  const date = new Date(isoDate)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return `${dateFormatter.format(date)} às ${timeFormatter.format(date)}`
}

function timeOf(version: CodeVersion): number {
  const time = new Date(version.createdAt).getTime()

  return Number.isNaN(time) ? 0 : time
}

/**
 * Newest first, with the same `(created_at, id)` tiebreak the backend uses for
 * retention. The wire order is never trusted: two snapshots can share a second.
 */
export function orderVersionsNewestFirst(versions: CodeVersion[]): CodeVersion[] {
  return [...versions].sort((left, right) => {
    const difference = timeOf(right) - timeOf(left)

    if (difference !== 0) {
      return difference
    }

    return right.id.localeCompare(left.id)
  })
}
