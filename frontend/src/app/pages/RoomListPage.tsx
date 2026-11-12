import { Link, useSearchParams } from 'react-router-dom'
import { Button, EmptyState } from '../../shared/components'
import { RoomCard } from '../../features/rooms'
import type { RoomSummary } from '../../features/rooms'

type RoomListPageProps = {
  ownedRooms?: RoomSummary[]
  joinedRooms?: RoomSummary[]
  isLoading?: boolean
  onCreateRoom?: () => void
}

const TAB_CLASSES = {
  active: 'border-accent bg-muted text-foreground',
  inactive: 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
} as const

function tabClassName(isActive: boolean) {
  return [
    'inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium transition',
    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
    isActive ? TAB_CLASSES.active : TAB_CLASSES.inactive,
  ].join(' ')
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`
}

export default function RoomListPage({
  ownedRooms = [],
  joinedRooms = [],
  isLoading = false,
  onCreateRoom,
}: RoomListPageProps) {
  const [searchParams] = useSearchParams()
  const isJoinedTab = searchParams.get('tab') === 'joined'
  const rooms = isJoinedTab ? joinedRooms : ownedRooms
  const openCount = rooms.filter((room) => room.status === 'active').length
  const closedCount = rooms.length - openCount

  return (
    <section aria-labelledby="room-list-heading">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            id="room-list-heading"
            className="font-mono text-3xl font-semibold tracking-tight"
          >
            Suas salas
          </h1>
          <p className="mt-2 text-muted-foreground">
            Gerencie as salas que você criou e as que acompanhou.
          </p>
        </div>
        <Button type="button" onClick={onCreateRoom}>
          Nova sala
        </Button>
      </header>

      <nav aria-label="Filtro de salas" className="mt-6 flex gap-2">
        <Link
          to="/rooms"
          aria-current={isJoinedTab ? undefined : 'true'}
          className={tabClassName(!isJoinedTab)}
        >
          Minhas
        </Link>
        <Link
          to="/rooms?tab=joined"
          aria-current={isJoinedTab ? 'true' : undefined}
          className={tabClassName(isJoinedTab)}
        >
          Participei
        </Link>
      </nav>

      {isLoading ? (
        <p role="status" className="mt-8 text-muted-foreground">
          Carregando salas…
        </p>
      ) : rooms.length === 0 ? (
        <div className="mt-8">
          {isJoinedTab ? (
            <EmptyState
              title="Você ainda não participou de nenhuma sala"
              description="Quando alguém compartilhar um código de acesso com você, a sala aparece aqui."
            />
          ) : (
            <EmptyState
              title="Nenhuma sala ainda"
              description="Crie sua primeira sala, escolha a linguagem e compartilhe o código com a turma."
              action={
                <Button type="button" onClick={onCreateRoom}>
                  Criar sala
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted-foreground">
            {countLabel(openCount, 'aberta', 'abertas')} ·{' '}
            {countLabel(closedCount, 'encerrada', 'encerradas')}
          </p>
          <ul className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <li key={room.id}>
                <RoomCard room={room} href={`/rooms/${room.id}`} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
