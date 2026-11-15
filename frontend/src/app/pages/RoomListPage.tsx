import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, EmptyState } from '../../shared/components'
import {
  ConfirmDialog,
  CreateRoomDialog,
  RoomCard,
  roomsErrorMessage,
} from '../../features/rooms'
import type { RoomLanguage, RoomListItem, RoomSummary } from '../../features/rooms'

const LOAD_ERROR_FALLBACK = 'Não foi possível carregar suas salas. Tente novamente.'
const JOINED_LOAD_ERROR_FALLBACK = 'Não foi possível carregar as salas que você participou.'
const CREATE_ERROR_FALLBACK = 'Não foi possível criar a sala. Tente novamente.'
const CLOSE_ERROR_FALLBACK = 'Não foi possível encerrar a sala. Tente novamente.'
const REGENERATE_ERROR_FALLBACK = 'Não foi possível regenerar o código. Tente novamente.'

const TAB_CLASSES =
  'inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none'

type RoomTab = 'mine' | 'joined'

type PendingAction = {
  kind: 'close' | 'regenerate'
  room: RoomSummary
}

type RoomListPageProps = {
  tab?: RoomTab
  rooms: RoomListItem[]
  isLoading?: boolean
  errorMessage?: string | null
  isSessionExpired?: boolean
  onRetry?: () => void
  onCreateRoom: (language: RoomLanguage) => Promise<RoomSummary>
  onCloseRoom: (room: RoomSummary) => Promise<RoomSummary>
  onRegenerateCode: (room: RoomSummary) => Promise<RoomSummary>
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`
}

export default function RoomListPage({
  tab = 'mine',
  rooms,
  isLoading = false,
  errorMessage = null,
  isSessionExpired = false,
  onRetry,
  onCreateRoom,
  onCloseRoom,
  onRegenerateCode,
}: RoomListPageProps) {
  const [createOpen, setCreateOpen] = useState(false)
  const [createPending, setCreatePending] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [actionPending, setActionPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const isJoinedTab = tab === 'joined'
  const heading = isJoinedTab ? 'Salas que participei' : 'Minhas salas'
  const description = isJoinedTab
    ? 'Salas em que você entrou como espectador, com acesso rápido para assistir.'
    : 'Crie salas, compartilhe o código de acesso e gerencie o que já aconteceu.'
  const loadErrorFallback = isJoinedTab ? JOINED_LOAD_ERROR_FALLBACK : LOAD_ERROR_FALLBACK
  const openCount = rooms.filter((room) => room.status === 'active').length
  const closedCount = rooms.length - openCount
  const hasRooms = rooms.length > 0
  const showFullError = Boolean(errorMessage) && !hasRooms && !isLoading
  const showStaleBanner = Boolean(errorMessage) && hasRooms

  const openCreateDialog = useCallback(() => {
    setCreateError(null)
    setCreateOpen(true)
  }, [])

  const closeCreateDialog = useCallback(() => {
    if (createPending) return
    setCreateOpen(false)
    setCreateError(null)
  }, [createPending])

  async function handleCreate(language: RoomLanguage) {
    setCreatePending(true)
    setCreateError(null)
    try {
      const room = await onCreateRoom(language)
      setCreateOpen(false)
      setAnnouncement(`Sala criada. Código de acesso ${room.accessCode}.`)
    } catch (error) {
      setCreateError(roomsErrorMessage(error, CREATE_ERROR_FALLBACK))
    } finally {
      setCreatePending(false)
    }
  }

  function openConfirmation(kind: PendingAction['kind'], room: RoomSummary) {
    setActionError(null)
    setPendingAction({ kind, room })
  }

  function cancelConfirmation() {
    if (actionPending) return
    setPendingAction(null)
    setActionError(null)
  }

  async function confirmAction() {
    if (!pendingAction) return
    const { kind, room } = pendingAction
    setActionPending(true)
    setActionError(null)

    try {
      if (kind === 'close') {
        await onCloseRoom(room)
        setAnnouncement(`Sala ${room.accessCode} encerrada.`)
      } else {
        const updated = await onRegenerateCode(room)
        setAnnouncement(
          `Novo código de acesso: ${updated.accessCode}. O código anterior não funciona mais.`,
        )
      }
      setPendingAction(null)
    } catch (error) {
      setActionError(
        roomsErrorMessage(error, kind === 'close' ? CLOSE_ERROR_FALLBACK : REGENERATE_ERROR_FALLBACK),
      )
    } finally {
      setActionPending(false)
    }
  }

  const confirmTitle =
    pendingAction?.kind === 'close'
      ? `Encerrar sala ${pendingAction.room.accessCode}?`
      : 'Regenerar código de acesso?'
  const confirmDescription =
    pendingAction?.kind === 'close'
      ? 'Espectadores não poderão mais entrar e a sala não poderá ser reaberta. O código atual continua disponível para leitura.'
      : 'O código atual deixa de funcionar imediatamente. Quem já está na sala continua conectado; novas entradas precisam do novo código.'

  return (
    <section aria-labelledby="room-list-heading">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            id="room-list-heading"
            tabIndex={-1}
            className="font-mono text-3xl font-semibold tracking-tight focus-visible:outline-none"
          >
            {heading}
          </h1>
          <p className="mt-2 text-muted-foreground">{description}</p>
        </div>
        {isJoinedTab ? null : (
          <Button type="button" onClick={openCreateDialog}>
            Nova sala
          </Button>
        )}
      </header>

      <nav aria-label="Filtro de salas" className="mt-6 flex flex-wrap gap-2">
        <Link
          to="/rooms"
          aria-current={isJoinedTab ? undefined : 'page'}
          className={[
            TAB_CLASSES,
            isJoinedTab
              ? 'text-muted-foreground hover:text-foreground'
              : 'bg-muted text-foreground',
          ].join(' ')}
        >
          Criadas por mim
        </Link>
        <Link
          to="/rooms?tab=joined"
          aria-current={isJoinedTab ? 'page' : undefined}
          className={[
            TAB_CLASSES,
            isJoinedTab
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          Participei
        </Link>
      </nav>

      {announcement ? (
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
      ) : null}

      {showStaleBanner ? (
        <div
          role="alert"
          className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/60 bg-muted px-4 py-3"
        >
          <p className="text-sm text-foreground">{errorMessage}</p>
          {onRetry ? (
            <Button type="button" variant="secondary" className="px-4" onClick={onRetry}>
              Tentar novamente
            </Button>
          ) : null}
        </div>
      ) : null}

      {isLoading && !hasRooms ? (
        <p role="status" className="mt-8 text-muted-foreground">
          Carregando salas…
        </p>
      ) : showFullError ? (
        <div
          role="alert"
          className="mt-8 flex flex-col items-start gap-3 rounded-xl border border-destructive/60 bg-muted p-6"
        >
          <p className="text-sm text-foreground">
            {errorMessage ?? loadErrorFallback}
          </p>
          {onRetry ? (
            <Button type="button" onClick={onRetry}>
              {isSessionExpired ? 'Entrar novamente' : 'Tentar novamente'}
            </Button>
          ) : null}
        </div>
      ) : !hasRooms ? (
        <div className="mt-8">
          {isJoinedTab ? (
            <EmptyState
              title="Você ainda não participou de nenhuma sala"
              description="Peça o código de acesso ao dono da sala e entre para assistir à aula ao vivo."
            />
          ) : (
            <EmptyState
              title="Nenhuma sala ainda"
              description="Crie sua primeira sala, escolha a linguagem e compartilhe o código com a turma."
              action={
                <Button type="button" onClick={openCreateDialog}>
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
                <RoomCard
                  room={room}
                  href={isJoinedTab ? `/rooms/${room.id}/view` : `/rooms/${room.id}`}
                  openLabel={isJoinedTab ? 'Assistir' : undefined}
                  joinedAt={isJoinedTab ? room.joinedAt : undefined}
                  openable={!isJoinedTab || room.status === 'active'}
                  onClose={
                    isJoinedTab ? undefined : (target) => openConfirmation('close', target)
                  }
                  onRegenerateCode={
                    isJoinedTab ? undefined : (target) => openConfirmation('regenerate', target)
                  }
                />
              </li>
            ))}
          </ul>
        </>
      )}

      <CreateRoomDialog
        open={createOpen}
        isLoading={createPending}
        error={createError}
        onSubmit={handleCreate}
        onCancel={closeCreateDialog}
      />

      <ConfirmDialog
        open={pendingAction !== null}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={pendingAction?.kind === 'close' ? 'Encerrar sala' : 'Regenerar código'}
        loadingLabel={pendingAction?.kind === 'close' ? 'Encerrando…' : 'Regenerando…'}
        variant={pendingAction?.kind === 'close' ? 'danger' : 'primary'}
        isLoading={actionPending}
        error={actionError}
        fallbackFocusId="room-list-heading"
        onConfirm={confirmAction}
        onCancel={cancelConfirmation}
      />
    </section>
  )
}