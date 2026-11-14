import { useEffect, useRef } from 'react'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

type DialogProps = {
  open: boolean
  labelledBy: string
  describedBy?: string
  dismissible?: boolean
  /** Focus target when the trigger is gone (e.g. a card action removed after closing). */
  fallbackFocusId?: string
  onClose: () => void
  children: ReactNode
}

/**
 * Accessible modal shell.
 *
 * `jsdom` does not implement `<dialog>` reliably, so the modal is a plain
 * `div role="dialog"` with a manual focus trap. `onClose` and `dismissible`
 * are kept in refs so a parent re-render never resets the focus.
 */
export function Dialog({
  open,
  labelledBy,
  describedBy,
  dismissible = true,
  fallbackFocusId,
  onClose,
  children,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const dismissibleRef = useRef(dismissible)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    onCloseRef.current = onClose
    dismissibleRef.current = dismissible
  })

  useEffect(() => {
    if (!open) return

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const cancel = panel?.querySelector<HTMLElement>('[data-dialog-cancel]')
    const initial = cancel ?? panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? panel
    initial?.focus()

    return () => {
      const target = previouslyFocusedRef.current
      if (target && document.contains(target)) {
        target.focus()
        return
      }

      const fallback = fallbackFocusId ? document.getElementById(fallbackFocusId) : null
      fallback?.focus()
    }
  }, [open, fallbackFocusId])

  if (!open) return null

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      if (!dismissibleRef.current) return
      event.stopPropagation()
      onCloseRef.current()
      return
    }

    if (event.key !== 'Tab') return

    const panel = panelRef.current
    if (!panel) return

    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (!first || !last) {
      event.preventDefault()
      panel.focus()
      return
    }

    const active = document.activeElement
    const isOutside = !panel.contains(active)

    if (!event.shiftKey && (isOutside || active === last)) {
      event.preventDefault()
      first.focus()
    } else if (event.shiftKey && (isOutside || active === first)) {
      event.preventDefault()
      last.focus()
    }
  }

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (!dismissibleRef.current) return
    if (event.target !== event.currentTarget) return
    onCloseRef.current()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        data-testid="dialog-backdrop"
        aria-hidden="true"
        className="absolute inset-0 bg-background/80"
        onMouseDown={handleBackdropMouseDown}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="relative w-full max-w-md rounded-xl border border-border bg-surface p-6"
      >
        {children}
      </div>
    </div>
  )
}