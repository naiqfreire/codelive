import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  CONFLICT_ACCEPT_LABEL,
  CONFLICT_DESCRIPTION,
  CONFLICT_KEEP_LABEL,
  CONFLICT_TITLE,
  LATEST_VERSION_MESSAGE,
} from '../messages'
import { ConflictNotice, LatestVersionNotice } from './RoomSyncNotice'

describe('LatestVersionNotice', () => {
  it('reserves a polite live region without a status role', () => {
    const { container } = render(<LatestVersionNotice message={null} />)

    const region = container.querySelector('[aria-live="polite"]')
    expect(region).toBeInTheDocument()
    expect(region).not.toHaveAttribute('role')
    expect(region).toHaveTextContent('')
  })

  it('shows the latest version message', () => {
    render(<LatestVersionNotice message={LATEST_VERSION_MESSAGE} />)

    expect(screen.getByText(LATEST_VERSION_MESSAGE)).toBeInTheDocument()
  })
})

describe('ConflictNotice', () => {
  const conflict = {
    serverContent: 'print("servidor")',
    receivedAt: '2026-11-16T14:32:05.000Z',
  }

  it('explains the conflict and offers both choices', () => {
    render(
      <ConflictNotice
        conflict={conflict}
        onAcceptServer={vi.fn()}
        onKeepLocal={vi.fn()}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(CONFLICT_TITLE)
    expect(screen.getByText(CONFLICT_DESCRIPTION)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: CONFLICT_ACCEPT_LABEL })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: CONFLICT_KEEP_LABEL })).toBeInTheDocument()
    expect(screen.getByText(/recebida às/i)).toBeInTheDocument()
  })

  it('calls the chosen conflict action', () => {
    const onAcceptServer = vi.fn()
    const onKeepLocal = vi.fn()

    render(
      <ConflictNotice
        conflict={conflict}
        onAcceptServer={onAcceptServer}
        onKeepLocal={onKeepLocal}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: CONFLICT_ACCEPT_LABEL }))
    fireEvent.click(screen.getByRole('button', { name: CONFLICT_KEEP_LABEL }))

    expect(onAcceptServer).toHaveBeenCalledTimes(1)
    expect(onKeepLocal).toHaveBeenCalledTimes(1)
  })
})
