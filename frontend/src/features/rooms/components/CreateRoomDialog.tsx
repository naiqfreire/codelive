import { useEffect, useId, useState } from 'react'
import { Button } from '../../../shared/components'
import type { RoomLanguage } from '../languages'
import { Dialog } from './Dialog'
import { LanguageSelector } from './LanguageSelector'

const DEFAULT_LANGUAGE: RoomLanguage = 'python'

type CreateRoomDialogProps = {
  open: boolean
  isLoading?: boolean
  error?: string | null
  onSubmit: (language: RoomLanguage) => void
  onCancel: () => void
}

export function CreateRoomDialog({
  open,
  isLoading = false,
  error,
  onSubmit,
  onCancel,
}: CreateRoomDialogProps) {
  const [language, setLanguage] = useState<RoomLanguage>(DEFAULT_LANGUAGE)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (open) setLanguage(DEFAULT_LANGUAGE)
  }, [open])

  return (
    <Dialog
      open={open}
      labelledBy={titleId}
      describedBy={descriptionId}
      dismissible={!isLoading}
      onClose={onCancel}
    >
      <h2 id={titleId} className="font-mono text-xl font-semibold tracking-tight">
        Nova sala
      </h2>
      <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">
        Escolha a linguagem. O código de acesso é gerado automaticamente.
      </p>

      <form
        className="mt-4 space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (isLoading) return
          onSubmit(language)
        }}
      >
        <LanguageSelector
          value={language}
          onChange={setLanguage}
          disabled={isLoading}
          hint="A linguagem não pode ser alterada depois da criação."
        />

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            data-dialog-cancel
            disabled={isLoading}
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {isLoading ? 'Criando…' : 'Criar sala'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}