import { useId, useMemo, useState } from 'react'
import { ConfirmDialog, LANGUAGE_OPTIONS } from '../../rooms'
import { Button, EmptyState, Spinner } from '../../../shared/components'
import { formatVersionDateTime, orderVersionsNewestFirst } from '../format'
import {
  VERSION_LOAD_ERROR_FALLBACK,
  VERSION_RESTORE_ERROR_FALLBACK,
  versionsErrorMessage,
} from '../messages'
import type { CodeVersion } from '../types'

/** Retention keeps 30 days of snapshots, so the list can be long. */
export const VERSIONS_PAGE_SIZE = 20

const RESTORE_DESCRIPTION =
  'O código da sala será substituído por esta versão e uma nova versão será criada. Espectadores veem a mudança imediatamente.'

const CLOSED_NOTICE =
  'Esta sala foi encerrada. O histórico continua disponível, mas não é possível restaurar versões.'

type VersionHistoryPanelProps = {
  versions: CodeVersion[]
  isLoading?: boolean
  errorMessage?: string | null
  /** `false` for a closed room: the backend answers 409 on restore. */
  canRestore?: boolean
  onRetry?: () => void
  onRestore: (version: CodeVersion) => Promise<void>
}

function languageLabel(language: CodeVersion['language']) {
  return LANGUAGE_OPTIONS.find((option) => option.value === language)?.label ?? language
}

/**
 * Presentational history panel: list, selection and the restore confirmation.
 *
 * The list is metadata-only because the backend `VersionOut` carries no
 * content. The panel owns the selection and the restore dialog; the connected
 * container (`VersionHistory`) owns the API and the editor sync.
 */
export function VersionHistoryPanel({
  versions,
  isLoading = false,
  errorMessage = null,
  canRestore = true,
  onRetry,
  onRestore,
}: VersionHistoryPanelProps) {
  const headingId = useId()
  const groupName = useId()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingVersion, setPendingVersion] = useState<CodeVersion | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [visibleCount, setVisibleCount] = useState(VERSIONS_PAGE_SIZE)

  const ordered = useMemo(() => orderVersionsNewestFirst(versions), [versions])
  const visible = ordered.slice(0, visibleCount)
  const hasMore = ordered.length > visibleCount
  const hasVersions = versions.length > 0
  const selected = ordered.find((version) => version.id === selectedId) ?? null

  const showInitialLoading = isLoading && !hasVersions
  const showInitialError = !isLoading && !hasVersions && Boolean(errorMessage)
  const showEmpty = !isLoading && !hasVersions && !errorMessage
  const showStaleBanner = Boolean(errorMessage) && hasVersions

  function requestRestore() {
    if (!selected || !canRestore) return
    setRestoreError(null)
    setPendingVersion(selected)
  }

  function cancelRestore() {
    if (isRestoring) return
    setPendingVersion(null)
    setRestoreError(null)
  }

  async function confirmRestore() {
    if (!pendingVersion) return
    setRestoreError(null)
    setIsRestoring(true)

    try {
      await onRestore(pendingVersion)
      setPendingVersion(null)
      setSelectedId(null)
      setAnnouncement(
        `Versão de ${formatVersionDateTime(pendingVersion.createdAt)} restaurada. O código da sala foi atualizado.`,
      )
    } catch (error) {
      setRestoreError(versionsErrorMessage(error, VERSION_RESTORE_ERROR_FALLBACK))
    } finally {
      setIsRestoring(false)
    }
  }

  const pendingWhen = pendingVersion ? formatVersionDateTime(pendingVersion.createdAt) : ''
  const confirmTitle = pendingWhen ? `Restaurar versão de ${pendingWhen}?` : 'Restaurar versão?'

  return (
    <section aria-labelledby={headingId} className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="text-sm font-medium text-foreground">
          Histórico de versões
        </h2>
        {hasVersions ? (
          <p className="text-xs text-muted-foreground">
            {versions.length} {versions.length === 1 ? 'versão' : 'versões'}
          </p>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Uma versão automática é salva a cada 30 segundos quando o código muda.
      </p>

      {showStaleBanner ? (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/60 bg-muted px-4 py-3"
        >
          <p className="text-sm text-foreground">{errorMessage}</p>
          {onRetry ? (
            <Button type="button" variant="secondary" className="px-4" onClick={onRetry}>
              Tentar novamente
            </Button>
          ) : null}
        </div>
      ) : null}

      {showInitialLoading ? (
        <div
          role="status"
          className="mt-4 flex min-h-24 items-center justify-center gap-2 text-muted-foreground"
        >
          <Spinner />
          <span>Carregando histórico…</span>
        </div>
      ) : showInitialError ? (
        <div
          role="alert"
          className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-destructive/60 bg-muted p-4"
        >
          <p className="text-sm text-foreground">{errorMessage ?? VERSION_LOAD_ERROR_FALLBACK}</p>
          {onRetry ? (
            <Button type="button" onClick={onRetry}>
              Tentar novamente
            </Button>
          ) : null}
        </div>
      ) : showEmpty ? (
        <div className="mt-4">
          <EmptyState
            title="Nenhuma versão ainda"
            description="A primeira versão aparece assim que o código da sala mudar."
          />
        </div>
      ) : (
        <>
          <fieldset className="mt-4 min-w-0">
            <legend className="sr-only">Versões da sala</legend>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {visible.map((version) => {
                const isSelected = version.id === selectedId

                return (
                  <li key={version.id} className={isSelected ? 'bg-muted' : ''}>
                    <label className="flex min-h-11 cursor-pointer items-start gap-3 px-3 py-3 transition hover:bg-muted/60">
                      <input
                        type="radio"
                        name={groupName}
                        value={version.id}
                        checked={isSelected}
                        onChange={() => setSelectedId(version.id)}
                        className="mt-1 size-4 shrink-0 cursor-pointer accent-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-sm text-foreground">
                          {formatVersionDateTime(version.createdAt)}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">
                            {version.authorId ? 'Restauração' : 'Automática'}
                          </span>
                          <span>{languageLabel(version.language)}</span>
                          <span className="font-mono" title={version.contentHash}>
                            #{version.contentHash.slice(0, 7)}
                          </span>
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </fieldset>

          {hasMore ? (
            <div className="mt-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setVisibleCount((count) => count + VERSIONS_PAGE_SIZE)}
              >
                Mostrar versões anteriores
              </Button>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={requestRestore} disabled={!selected || !canRestore}>
              Restaurar versão
            </Button>
            {!canRestore ? <p className="text-sm text-muted-foreground">{CLOSED_NOTICE}</p> : null}
          </div>
        </>
      )}

      {announcement ? (
        <p aria-live="polite" className="mt-4 min-h-5 text-sm text-muted-foreground">
          {announcement}
        </p>
      ) : null}

      <ConfirmDialog
        open={pendingVersion !== null}
        title={confirmTitle}
        description={RESTORE_DESCRIPTION}
        confirmLabel="Restaurar versão"
        loadingLabel="Restaurando…"
        isLoading={isRestoring}
        error={restoreError}
        onConfirm={() => {
          void confirmRestore()
        }}
        onCancel={cancelRestore}
      />
    </section>
  )
}
