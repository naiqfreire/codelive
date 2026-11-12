import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, EmptyState, StatusBadge } from '../../shared/components'
import { AccessCode, LanguageSelector } from '../../features/rooms'
import type { RoomDetail, RoomLanguage } from '../../features/rooms'
import { CodeEditor } from '../../features/live_code'

type OwnerRoomPageProps = {
  room?: RoomDetail
  onClose?: () => void
  onRegenerateCode?: () => void
  onLanguageChange?: (language: RoomLanguage) => void
}

type RoomActionsProps = {
  isClosed: boolean
  onClose?: () => void
  onRegenerateCode?: () => void
}

function RoomActions({ isClosed, onClose, onRegenerateCode }: RoomActionsProps) {
  return (
    <>
      <Button type="button" variant="secondary" onClick={onRegenerateCode} disabled={isClosed}>
        Regenerar código
      </Button>
      <Button type="button" variant="secondary" onClick={onClose} disabled={isClosed}>
        Encerrar sala
      </Button>
    </>
  )
}

function BackLink() {
  return (
    <Link
      to="/rooms"
      className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
    >
      <span aria-hidden="true">←</span> Voltar para suas salas
    </Link>
  )
}

export default function OwnerRoomPage({
  room,
  onClose,
  onRegenerateCode,
  onLanguageChange,
}: OwnerRoomPageProps) {
  const [code, setCode] = useState(room?.code ?? '')
  const isClosed = room?.status === 'closed'

  if (!room) {
    return (
      <section aria-labelledby="owner-room-heading" className="space-y-6">
        <BackLink />
        <h1 id="owner-room-heading" className="font-mono text-3xl font-semibold tracking-tight">
          Sala não encontrada
        </h1>
        <EmptyState
          title="Verifique o endereço"
          description="O endereço acessado não corresponde a nenhuma sala sua. Volte para a lista e abra a sala por lá."
        />
      </section>
    )
  }

  return (
    <section aria-labelledby="owner-room-heading" className="space-y-6">
      <BackLink />

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1
            id="owner-room-heading"
            className="font-mono text-3xl font-semibold tracking-tight"
          >
            Sua sala
          </h1>
          <StatusBadge status={room.status} />
        </div>
        <p className="text-muted-foreground">
          {isClosed
            ? 'Esta sala foi encerrada. O código continua disponível para leitura, mas ninguém pode mais entrar nem editar.'
            : 'Compartilhe o código abaixo com quem vai assistir à aula.'}
        </p>
      </header>

      <div className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <AccessCode mode="display" code={room.accessCode} />
        </div>
        <div className="w-full space-y-3 sm:w-44">
          <LanguageSelector
            value={room.language}
            onChange={(language) => onLanguageChange?.(language)}
          />
          <div className="hidden gap-2 md:flex md:flex-col">
            <RoomActions
              isClosed={isClosed}
              onClose={onClose}
              onRegenerateCode={onRegenerateCode}
            />
          </div>
          <details className="md:hidden">
            <summary
              aria-label="Mais ações"
              className="inline-flex min-h-11 w-full cursor-pointer list-none items-center justify-center rounded-lg border border-border px-4 font-medium transition hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
            >
              <span aria-hidden="true">···</span>
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <RoomActions
                isClosed={isClosed}
                onClose={onClose}
                onRegenerateCode={onRegenerateCode}
              />
            </div>
          </details>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-foreground">Código da sala</h2>
        <CodeEditor
          value={code}
          language={room.language}
          readOnly={isClosed}
          onChange={setCode}
          label="Editor de código"
          className="h-[60vh]"
        />
      </div>
    </section>
  )
}
