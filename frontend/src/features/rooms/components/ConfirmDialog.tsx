import { useId } from 'react'
import { Button } from '../../../shared/components'
import { Dialog } from './Dialog'

type ConfirmDialogProps = {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  loadingLabel?: string
  variant?: 'primary' | 'danger'
  isLoading?: boolean
  error?: string | null
  fallbackFocusId?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  loadingLabel = 'Encerrando…',
  variant = 'primary',
  isLoading = false,
  error,
  fallbackFocusId,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId()
  const descriptionId = useId()

  return (
    <Dialog
      open={open}
      labelledBy={titleId}
      describedBy={descriptionId}
      dismissible={!isLoading}
      fallbackFocusId={fallbackFocusId}
      onClose={onCancel}
    >
      <h2 id={titleId} className="font-mono text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">
        {description}
      </p>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          data-dialog-cancel
          disabled={isLoading}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button type="button" variant={variant} isLoading={isLoading} onClick={onConfirm}>
          {isLoading ? loadingLabel : confirmLabel}
        </Button>
      </div>
    </Dialog>
  )
}