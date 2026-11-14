import { useState } from 'react'
import type { ReactNode } from 'react'

import { ParticipantList } from '../../features/membership'
import type { Participant } from '../../features/membership'
import { COPIED_MESSAGE, COPY_FAILURE_MESSAGE, copyText, LANGUAGE_OPTIONS } from '../../features/rooms'
import type { RoomLanguage, RoomStatus } from '../../features/rooms'
import { StatusBadge } from '../../shared/components'

type RoomLayoutProps = {
  title: string
  /** Id of the `h1`, so the page can label its `section` with it. */
  headingId?: string
  accessCode: string
  language: RoomLanguage
  status: RoomStatus
  /** Interface-only lock; the server enforces the rule (RF06/RNF01). */
  readOnly?: boolean
  readOnlyNotice?: string
  /** Live connection pill, rendered by the page that owns the socket. */
  connection?: ReactNode
  /** Owner-only actions, rendered at the end of the header row. */
  actions?: ReactNode
  /** Replaces the read-only language chip (the owner's selector). */
  languageControl?: ReactNode
  participants?: Participant[]
  /** Live presence count, used while the API does not expose names. */
  participantCount?: number
  children: ReactNode
}

function languageLabel(language: RoomLanguage) {
  return LANGUAGE_OPTIONS.find((option) => option.value === language)?.label ?? language
}

/**
 * Shared shell of the room screen, used by both the owner and the spectator.
 *
 * The code area is the main content and receives the whole free width; the
 * participants panel is a narrow aside from `lg` up and stacks below the editor
 * on smaller screens. The header carries the room identity (title, access code),
 * language and status, so the pages themselves stay thin.
 */
export function RoomLayout({
  title,
  headingId,
  accessCode,
  language,
  status,
  readOnly = false,
  readOnlyNotice,
  connection,
  actions,
  languageControl,
  participants,
  participantCount,
  children,
}: RoomLayoutProps) {
  const [copyFeedback, setCopyFeedback] = useState('')

  async function handleCopy() {
    setCopyFeedback((await copyText(accessCode)) ? COPIED_MESSAGE : COPY_FAILURE_MESSAGE)
  }

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1
            id={headingId}
            className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            {title}
          </h1>

          <span className="inline-flex items-center rounded-lg border border-border bg-surface pr-1 pl-3">
            <span className="font-mono text-sm tracking-[0.2em] select-all">{accessCode}</span>
            <button
              type="button"
              onClick={() => {
                void handleCopy()
              }}
              aria-label={`Copiar código ${accessCode}`}
              className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
              >
                <rect x="9" y="9" width="12" height="12" rx="2" />
                <path d="M5 15V5a2 2 0 0 1 2-2h10" />
              </svg>
            </button>
          </span>

          <StatusBadge status={status} />

          {readOnly ? (
            <span className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-medium whitespace-nowrap text-muted-foreground">
              Somente leitura
            </span>
          ) : null}

          {connection}

          {actions ? (
            <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {languageControl ?? (
            <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
              {languageLabel(language)}
            </span>
          )}
        </div>

        {readOnly && readOnlyNotice ? (
          <p className="text-muted-foreground">{readOnlyNotice}</p>
        ) : null}

        <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
          {copyFeedback}
        </p>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">{children}</div>
        <div className="w-full lg:w-72 lg:shrink-0">
          <ParticipantList participants={participants} count={participantCount} />
        </div>
      </div>
    </div>
  )
}
