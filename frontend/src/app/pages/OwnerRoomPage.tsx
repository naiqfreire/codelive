import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, EmptyState } from '../../shared/components'
import { LanguageSelector } from '../../features/rooms'
import type { RoomDetail, RoomLanguage } from '../../features/rooms'
import { CodeEditor } from '../../features/live_code'
import { RoomLayout } from '../layouts/RoomLayout'

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

const CLOSED_NOTICE =
  'Esta sala foi encerrada. O código continua disponível para leitura, mas ninguém pode mais entrar nem editar.'

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

      <RoomLayout
        title="Sua sala"
        headingId="owner-room-heading"
        accessCode={room.accessCode}
        language={room.language}
        status={room.status}
        readOnly={isClosed}
        readOnlyNotice={CLOSED_NOTICE}
        actions={
          <RoomActions
            isClosed={isClosed}
            onClose={onClose}
            onRegenerateCode={onRegenerateCode}
          />
        }
        languageControl={
          <LanguageSelector
            value={room.language}
            onChange={(language) => onLanguageChange?.(language)}
            disabled={isClosed}
          />
        }
      >
        <h2 className="mb-2 text-sm font-medium text-foreground">Código da sala</h2>
        <CodeEditor
          value={code}
          language={room.language}
          readOnly={isClosed}
          onChange={setCode}
          label="Editor de código"
          className="h-[60vh] lg:h-[70vh]"
        />
      </RoomLayout>
    </section>
  )
}
