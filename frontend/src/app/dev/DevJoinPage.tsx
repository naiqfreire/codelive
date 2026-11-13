import { useState } from 'react'

import { JoinRoomModal } from '../../features/membership'
import type { JoinChoice } from '../../features/membership'
import { Button } from '../../shared/components'

/**
 * Development-only page used to review the spectator entry modal before the
 * real join flow exists. Reachable at `/rooms/join` in `npm run dev` only; the
 * production route belongs to the spectator flow task.
 */
export default function DevJoinPage() {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [choice, setChoice] = useState<JoinChoice | null>(null)

  function handleJoin(next: JoinChoice) {
    setChoice(next)
    setIsOpen(false)
  }

  return (
    <section aria-labelledby="dev-join-heading" className="max-w-xl">
      <h1 id="dev-join-heading" className="font-mono text-3xl font-semibold tracking-tight">
        Entrar em uma sala
      </h1>
      <p className="mt-2 text-muted-foreground">
        Página de desenvolvimento para revisar o modal de entrada (passo 3 do fluxo do espectador).
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button type="button" onClick={() => setIsOpen(true)}>
          Abrir modal de entrada
        </Button>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={isSubmitting}
            onChange={(event) => setIsSubmitting(event.target.checked)}
            className="size-4 accent-accent"
          />
          Simular envio em andamento
        </label>
      </div>

      {choice ? (
        <p role="status" className="mt-6 rounded-lg border border-border bg-surface p-4 text-sm">
          <span className="text-muted-foreground">Escolha registrada: </span>
          <span className="font-mono text-foreground">
            {choice.nickname} · {choice.anonymous ? 'sem conta' : 'com conta'}
          </span>
        </p>
      ) : null}

      {isOpen ? (
        <JoinRoomModal
          accessCode="K7M2QX"
          isSubmitting={isSubmitting}
          onJoin={handleJoin}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </section>
  )
}
