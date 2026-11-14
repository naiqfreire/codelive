import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  accessCodeErrorMessage,
  CLOSED_ROOM_MESSAGE,
  normalizeAccessCode,
  validateAccessCode,
} from '../../features/rooms'
import type { RoomLookup } from '../../features/rooms'
import { Button, TextField } from '../../shared/components'
import { ApiError } from '../../shared/http'

const FIELD_ID = 'access-code'

const LOOKUP_ERROR_FALLBACK = 'Não foi possível validar o código. Tente novamente.'

type CodeEntryPageProps = {
  initialCode?: string
  onSubmit: (code: string) => Promise<RoomLookup>
  onValidRoom: (room: RoomLookup) => void
  onSessionExpired: () => Promise<void>
}

export default function CodeEntryPage({
  initialCode,
  onSubmit,
  onValidRoom,
  onSessionExpired,
}: CodeEntryPageProps) {
  const [code, setCode] = useState(() => normalizeAccessCode(initialCode ?? ''))
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSessionExpired, setIsSessionExpired] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isReauthenticating, setIsReauthenticating] = useState(false)
  const [pendingFocus, setPendingFocus] = useState(false)

  // A field disabled during the request cannot take focus, so the focus is
  // applied after the loading state goes back to false.
  useEffect(() => {
    if (!pendingFocus || isLoading) return
    setPendingFocus(false)
    document.getElementById(FIELD_ID)?.focus()
  }, [pendingFocus, isLoading])

  function handleCodeChange(value: string) {
    const normalized = normalizeAccessCode(value)
    setCode(normalized)

    if (fieldError) {
      const result = validateAccessCode(normalized)
      setFieldError(result.ok ? null : result.error)
    }

    if (formError) {
      setFormError(null)
      setIsSessionExpired(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setIsSessionExpired(false)

    const result = validateAccessCode(code)

    if (!result.ok) {
      setFieldError(result.error)
      setPendingFocus(true)
      return
    }

    setFieldError(null)
    setIsLoading(true)

    try {
      const room = await onSubmit(result.value)

      if (room.status === 'closed') {
        setFormError(CLOSED_ROOM_MESSAGE)
        return
      }

      onValidRoom(room)
    } catch (error) {
      const message = accessCodeErrorMessage(error, LOOKUP_ERROR_FALLBACK)

      if (error instanceof ApiError && error.code === 'room_not_found') {
        setFieldError(message)
        setPendingFocus(true)
        return
      }

      if (error instanceof ApiError && error.status === 401) {
        setIsSessionExpired(true)
      }

      setFormError(message)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleReauthenticate() {
    setIsReauthenticating(true)

    try {
      await onSessionExpired()
    } finally {
      setIsReauthenticating(false)
    }
  }

  return (
    <section aria-labelledby="code-entry-heading" className="max-w-md">
      <p className="text-xs font-medium tracking-[0.2em] text-accent uppercase">Passo 2 de 4</p>
      <h1
        id="code-entry-heading"
        tabIndex={-1}
        className="mt-2 font-mono text-3xl font-semibold tracking-tight focus-visible:outline-none"
      >
        Entrar com código
      </h1>
      <p className="mt-2 text-muted-foreground">
        Digite o código de 6 caracteres que o dono da sala compartilhou.
      </p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
        <TextField
          id={FIELD_ID}
          label="Código de acesso"
          hint="6 caracteres, como K7M2QX."
          value={code}
          onChange={(event) => handleCodeChange(event.target.value)}
          error={fieldError ?? undefined}
          disabled={isLoading}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          placeholder="K7M2QX"
          className="font-mono tracking-[0.25em] uppercase"
        />

        {formError ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/60 bg-muted px-4 py-3"
          >
            <p className="text-sm text-foreground">{formError}</p>
            {isSessionExpired ? (
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                isLoading={isReauthenticating}
                onClick={() => {
                  void handleReauthenticate()
                }}
              >
                {isReauthenticating ? 'Entrando…' : 'Entrar novamente'}
              </Button>
            ) : null}
          </div>
        ) : null}

        <Button type="submit" isLoading={isLoading} className="w-full">
          {isLoading ? 'Verificando…' : 'Continuar'}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        <Link className="font-medium text-accent underline-offset-4 hover:underline" to="/rooms">
          Voltar para minhas salas
        </Link>
      </p>
    </section>
  )
}
