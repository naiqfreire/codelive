import { useState } from 'react'
import type { FormEvent } from 'react'

import { Button } from '../../../shared/components/Button'
import { TextField } from '../../../shared/components/TextField'
import { NICKNAME_MAX_LENGTH, validateNickname } from '../nickname'
import type { JoinChoice } from '../types'
import { Modal } from './Modal'

type JoinRoomModalProps = {
  accessCode?: string
  isSubmitting?: boolean
  /** True when the visitor has no account and the API must be called as anonymous. */
  anonymousEntry?: boolean
  /** Server-side failure to keep visible while the modal stays open. */
  error?: string | null
  onJoin: (choice: JoinChoice) => void
  onClose: () => void
}

/**
 * Entry step of the spectator flow (RNF03, step 3).
 *
 * The nickname is required even for the anonymous entry: `anonymous` means
 * "no account", not "no name" — the backend rejects an anonymous join without
 * a nickname (422) because presence needs a name to identify who is in the
 * room. The route owns the request and decides the identity from the session;
 * this component only reports the choice.
 */
export function JoinRoomModal({
  accessCode,
  isSubmitting = false,
  anonymousEntry = false,
  error = null,
  onJoin,
  onClose,
}: JoinRoomModalProps) {
  const [nickname, setNickname] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)

  function submit() {
    const result = validateNickname(nickname)

    if (!result.ok) {
      setFieldError(result.error)
      return
    }

    setFieldError(null)
    onJoin({ nickname: result.value, anonymous: anonymousEntry })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submit()
  }

  function handleNicknameChange(value: string) {
    setNickname(value)

    // Only revalidate once the field has already failed, so the error does not
    // appear while the user is still typing the first character.
    if (fieldError) {
      const result = validateNickname(value)
      setFieldError(result.ok ? null : result.error)
    }
  }

  return (
    <Modal
      title="Entrar na sala"
      description={
        accessCode
          ? `Sala ${accessCode}. Escolha como você quer aparecer para quem já está nela.`
          : 'Escolha como você quer aparecer para quem já está na sala.'
      }
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <TextField
          label="Nickname"
          hint={`Até ${NICKNAME_MAX_LENGTH} caracteres.`}
          error={fieldError ?? undefined}
          value={nickname}
          onChange={(event) => handleNicknameChange(event.target.value)}
          disabled={isSubmitting}
          autoComplete="nickname"
          placeholder="Como você quer ser chamado"
        />

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/60 bg-muted px-4 py-3 text-sm text-foreground"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando…' : anonymousEntry ? 'Entrar sem conta' : 'Entrar na sala'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
