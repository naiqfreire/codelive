import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/http'
import { QueryProvider } from '../../test/query'
import type { VersionsApi } from './api'
import type { CodeVersion, RestoredVersion } from './types'
import { VersionHistory } from './VersionHistory'

const ROOM_ID = '11111111-1111-1111-1111-111111111111'
const VERSION_ID = '22222222-2222-2222-2222-222222222222'

const versionA: CodeVersion = {
  id: VERSION_ID,
  createdAt: '2026-11-10T12:00:00Z',
  contentHash: 'a'.repeat(64),
  language: 'python',
  authorId: null,
}

const restored: RestoredVersion = {
  content: "print('restaurado')\n",
  contentHash: versionA.contentHash,
  id: '33333333-3333-3333-3333-333333333333',
  createdAt: '2026-11-10T12:10:00Z',
}

function createFakeVersionsApi(overrides: Partial<VersionsApi> = {}): VersionsApi {
  return {
    list: vi.fn(async () => [versionA]),
    restore: vi.fn(async () => restored),
    ...overrides,
  }
}

function renderHistory(
  api: VersionsApi,
  props: Partial<Parameters<typeof VersionHistory>[0]> = {},
) {
  const onRestored = vi.fn()
  const view = render(
    <QueryProvider>
      <VersionHistory
        roomId={ROOM_ID}
        roomStatus="active"
        onRestored={onRestored}
        api={api}
        {...props}
      />
    </QueryProvider>,
  )

  return { ...view, onRestored, api }
}

describe('VersionHistory', () => {
  it('loads the versions from the API', async () => {
    const api = createFakeVersionsApi()

    renderHistory(api)

    expect(await screen.findByRole('radio', { name: /09:00:00/ })).toBeInTheDocument()
    expect(api.list).toHaveBeenCalledWith(ROOM_ID)
  })

  it('shows the loading status while the request runs', () => {
    const api = createFakeVersionsApi({
      list: vi.fn(() => new Promise<CodeVersion[]>(() => {})),
    })

    renderHistory(api)

    expect(screen.getByRole('status')).toHaveTextContent('Carregando histórico…')
  })

  it('maps a forbidden listing into an actionable message', async () => {
    const api = createFakeVersionsApi({
      list: vi.fn(async () => {
        throw new ApiError(403, 'forbidden', 'x', 'req-1')
      }),
    })

    renderHistory(api)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Você não tem permissão para ver o histórico desta sala.',
    )
  })

  it('retries the listing after an error', async () => {
    const list = vi
      .fn<VersionsApi['list']>()
      .mockRejectedValueOnce(new ApiError(0, 'network_error', 'x', null))
      .mockResolvedValue([versionA])
    const api = createFakeVersionsApi({ list })

    renderHistory(api)

    fireEvent.click(await screen.findByRole('button', { name: 'Tentar novamente' }))

    expect(await screen.findByRole('radio', { name: /09:00:00/ })).toBeInTheDocument()
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('restores the selected version and hands the content to the editor', async () => {
    const api = createFakeVersionsApi()
    const { onRestored } = renderHistory(api)

    fireEvent.click(await screen.findByRole('radio', { name: /09:00:00/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar versão' }))

    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Restaurar versão' }))

    await waitFor(() => expect(onRestored).toHaveBeenCalledWith(restored.content))
    expect(api.restore).toHaveBeenCalledWith(ROOM_ID, VERSION_ID)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('blocks restore for a closed room', async () => {
    const api = createFakeVersionsApi()

    renderHistory(api, { roomStatus: 'closed' })

    expect(await screen.findByRole('radio', { name: /09:00:00/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restaurar versão' })).toBeDisabled()
    expect(
      screen.getByText(/esta sala foi encerrada.*não é possível restaurar versões/i),
    ).toBeInTheDocument()
  })
})
