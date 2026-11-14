import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { RoomLookup } from '../../features/rooms'
import { ApiError, NETWORK_ERROR_MESSAGE } from '../../shared/http'
import CodeEntryPage from './CodeEntryPage'

const activeRoom: RoomLookup = {
  id: '11111111-1111-1111-1111-111111111111',
  accessCode: 'K7M2QX',
  language: 'python',
  status: 'active',
  createdAt: '2026-11-09T17:30:00Z',
  ownerId: '22222222-2222-2222-2222-222222222222',
  updatedAt: '2026-11-10T10:00:00Z',
}

type PageProps = {
  initialCode?: string
  onSubmit?: (code: string) => Promise<RoomLookup>
  onValidRoom?: (room: RoomLookup) => void
  onSessionExpired?: () => Promise<void>
}

function renderPage(overrides: PageProps = {}) {
  const onSubmit = vi.fn<(code: string) => Promise<RoomLookup>>(async () => activeRoom)
  const onValidRoom = vi.fn<(room: RoomLookup) => void>()
  const onSessionExpired = vi.fn<() => Promise<void>>(async () => undefined)

  render(
    <MemoryRouter>
      <CodeEntryPage
        onSubmit={overrides.onSubmit ?? onSubmit}
        onValidRoom={overrides.onValidRoom ?? onValidRoom}
        onSessionExpired={overrides.onSessionExpired ?? onSessionExpired}
        initialCode={overrides.initialCode}
      />
    </MemoryRouter>,
  )

  return {
    onSubmit: overrides.onSubmit ?? onSubmit,
    onValidRoom: overrides.onValidRoom ?? onValidRoom,
    onSessionExpired: overrides.onSessionExpired ?? onSessionExpired,
  }
}

function codeField() {
  return screen.getByLabelText(/código de acesso/i)
}

describe('CodeEntryPage', () => {
  it('renders the step, heading and hint', () => {
    renderPage()

    expect(screen.getByText('Passo 2 de 4')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Entrar com código' })).toBeInTheDocument()
    expect(screen.getByText(/6 caracteres, como k7m2qx/i)).toBeInTheDocument()
  })

  it('starts from a code carried by navigation state', () => {
    renderPage({ initialCode: 'k7-m2qx' })

    expect(codeField()).toHaveValue('K7M2QX')
  })

  it('normalizes the code while typing', () => {
    renderPage()

    fireEvent.change(codeField(), { target: { value: 'k7-m2 qx' } })

    expect(codeField()).toHaveValue('K7M2QX')
  })

  it('reports an incomplete code without calling the API', () => {
    const { onSubmit } = renderPage()

    fireEvent.change(codeField(), { target: { value: 'K7M2Q' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(screen.getByText('O código de acesso tem 6 caracteres.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(codeField()).toHaveFocus()
  })

  it('reports an empty code without calling the API', () => {
    const { onSubmit } = renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(screen.getByText('Informe o código de acesso.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(codeField()).toHaveFocus()
  })

  it('submits the normalized code and hands the room to the caller', async () => {
    const { onSubmit, onValidRoom } = renderPage()

    fireEvent.change(codeField(), { target: { value: 'k7m2qx' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('K7M2QX'))
    await waitFor(() => expect(onValidRoom).toHaveBeenCalledWith(activeRoom))
  })

  it('shows the loading state and disables the field while validating', async () => {
    let resolveRoom: (room: RoomLookup) => void = () => undefined
    const onSubmit = vi.fn(
      () =>
        new Promise<RoomLookup>((resolve) => {
          resolveRoom = resolve
        }),
    )
    renderPage({ onSubmit })

    fireEvent.change(codeField(), { target: { value: 'K7M2QX' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    const button = screen.getByRole('button', { name: /verificando/i })
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toBeDisabled()
    expect(codeField()).toBeDisabled()

    resolveRoom(activeRoom)

    await waitFor(() => expect(codeField()).not.toBeDisabled())
  })

  it('blocks a closed room and does not continue', async () => {
    const closedRoom: RoomLookup = { ...activeRoom, status: 'closed' }
    const { onValidRoom } = renderPage({ onSubmit: async () => closedRoom })

    fireEvent.change(codeField(), { target: { value: 'K7M2QX' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(
      await screen.findByText('Esta sala já foi encerrada. Peça um novo código ao dono.'),
    ).toBeInTheDocument()
    expect(onValidRoom).not.toHaveBeenCalled()
  })

  it('shows a missing code next to the field and keeps the value', async () => {
    const onValidRoom = vi.fn()
    renderPage({
      onValidRoom,
      onSubmit: async () => {
        throw new ApiError(404, 'room_not_found', 'Sala não encontrada.', 'req-1')
      },
    })

    fireEvent.change(codeField(), { target: { value: 'ZZZZZZ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(
      await screen.findByText('Código não encontrado. Confira o código com quem criou a sala.'),
    ).toBeInTheDocument()
    expect(codeField()).toHaveValue('ZZZZZZ')
    expect(codeField()).toHaveFocus()
    expect(onValidRoom).not.toHaveBeenCalled()
  })

  it('shows a network error and allows trying again', async () => {
    const onSubmit = vi
      .fn<(code: string) => Promise<RoomLookup>>()
      .mockRejectedValueOnce(
        new ApiError(0, 'network_error', NETWORK_ERROR_MESSAGE, null),
      )
      .mockResolvedValueOnce(activeRoom)
    renderPage({ onSubmit })

    fireEvent.change(codeField(), { target: { value: 'K7M2QX' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText(NETWORK_ERROR_MESSAGE)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2))
  })

  it('clears the API error when the user edits the code', async () => {
    renderPage({
      onSubmit: async () => {
        throw new ApiError(0, 'network_error', NETWORK_ERROR_MESSAGE, null)
      },
    })

    fireEvent.change(codeField(), { target: { value: 'K7M2QX' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText(NETWORK_ERROR_MESSAGE)).toBeInTheDocument()

    fireEvent.change(codeField(), { target: { value: 'K7M2QY' } })

    expect(screen.queryByText(NETWORK_ERROR_MESSAGE)).not.toBeInTheDocument()
  })

  it('offers reauthentication when the session expired', async () => {
    const { onSessionExpired } = renderPage({
      onSubmit: async () => {
        throw new ApiError(401, 'not_authenticated', 'Não autenticado.', 'req-1')
      },
    })

    fireEvent.change(codeField(), { target: { value: 'K7M2QX' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText('Sua sessão expirou. Entre novamente.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Entrar novamente' }))

    await waitFor(() => expect(onSessionExpired).toHaveBeenCalledTimes(1))
  })
})
