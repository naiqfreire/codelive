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
  onJoin: (choice: JoinChoice) => void
  onClose: () => void
}

/**
 * Entry step of the spectator flow (RNF03, step 3).
 *
 * The nickname is required even for the anonymous entry: `anonymous` means
 * "no account", not "no name" — the backend rejects an anonymous join without
 * a nickname (422) because presence needs a name to identify who is in the
 * room. This component only reports the choice; the page owns the request.
 */
export function JoinRoomModal({
  accessCode,
  isSubmitting = false,
  onJoin,
  onClose,
}: JoinRoomModalProps) {
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(anonymous: boolean) {
    const result = validateNickname(nickname)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setError(null)
    onJoin({ nickname: result.value, anonymous })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submit(false)
  }

  function handleNicknameChange(value: string) {
    setNickname(value)

    // Only revalidate once the field has already failed, so the error does not
    // appear while the user is still typing the first character.
    if (error) {
      const result = validateNickname(value)
      setError(result.ok ? null : result.error)
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
          error={error ?? undefined}
          value={nickname}
          onChange={(event) => handleNicknameChange(event.target.value)}
          disabled={isSubmitting}
          autoComplete="nickname"
          placeholder="Como você quer ser chamado"
        />

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => submit(true)}
            disabled={isSubmitting}
          >
            Entrar sem conta
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            Entrar na sala
          </Button>
        </div>
      </form>
    </Modal>
  )
}
