import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/http'
import type { CodeVersion } from '../types'
import { VersionHistoryPanel } from './VersionHistoryPanel'

function version(id: string, createdAt: string, overrides: Partial<CodeVersion> = {}): CodeVersion {
  return {
    id,
    createdAt,
    contentHash: 'a'.repeat(64),
    language: 'python',
    authorId: null,
    ...overrides,
  }
}

const older = version('aaaaaaaa-0000-4000-8000-000000000001', '2026-11-10T12:00:00Z')
const newer = version('bbbbbbbb-0000-4000-8000-000000000002', '2026-11-10T12:05:00Z', {
  authorId: '44444444-4444-4444-4444-444444444444',
  language: 'java',
})

function renderPanel(props: Partial<Parameters<typeof VersionHistoryPanel>[0]> = {}) {
  return render(<VersionHistoryPanel versions={[]} onRestore={vi.fn(async () => {})} {...props} />)
}

describe('VersionHistoryPanel', () => {
  it('renders the section heading and the version count', () => {
    renderPanel({ versions: [older, newer] })

    expect(screen.getByRole('heading', { name: 'Histórico de versões' })).toBeInTheDocument()
    expect(screen.getByText('2 versões')).toBeInTheDocument()
  })

  it('uses the singular label for one version', () => {
    renderPanel({ versions: [older] })

    expect(screen.getByText('1 versão')).toBeInTheDocument()
  })

  it('shows a loading status while the first request runs', () => {
    renderPanel({ isLoading: true })

    expect(screen.getByRole('status')).toHaveTextContent('Carregando histórico…')
    expect(screen.queryByText('Nenhuma versão ainda')).not.toBeInTheDocument()
  })

  it('shows the empty state when the room has no versions', () => {
    renderPanel()

    expect(screen.getByText('Nenhuma versão ainda')).toBeInTheDocument()
    expect(screen.getByText(/a cada 30 segundos/i)).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('shows an actionable error without data', () => {
    const onRetry = vi.fn()
    renderPanel({ errorMessage: 'Falha ao carregar.', onRetry })

    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao carregar.')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('keeps the cached list and shows a banner when a refetch fails', () => {
    const onRetry = vi.fn()
    renderPanel({ versions: [older, newer], errorMessage: 'Falha ao atualizar.', onRetry })

    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao atualizar.')
    expect(screen.getAllByRole('radio')).toHaveLength(2)
    expect(screen.queryByText('Nenhuma versão ainda')).not.toBeInTheDocument()
  })

  it('lists the newest version first with date and time', () => {
    renderPanel({ versions: [older, newer] })

    const radios = screen.getAllByRole('radio')
    expect(radios[0]).toHaveAccessibleName(/10\/11\/2026 às 09:05:00/)
    expect(radios[1]).toHaveAccessibleName(/10\/11\/2026 às 09:00:00/)
  })

  it('tells an automatic snapshot from a restore and shows the language', () => {
    renderPanel({ versions: [older, newer] })

    expect(screen.getByText('Automática')).toBeInTheDocument()
    expect(screen.getByText('Restauração')).toBeInTheDocument()
    expect(screen.getByText('Java')).toBeInTheDocument()
  })

  it('reveals older versions on demand', () => {
    const many = Array.from({ length: 25 }, (_, index) =>
      version(
        `${String(index).padStart(8, '0')}-0000-4000-8000-000000000000`,
        `2026-11-10T12:${String(index).padStart(2, '0')}:00Z`,
      ),
    )
    renderPanel({ versions: many })

    expect(screen.getAllByRole('radio')).toHaveLength(20)

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar versões anteriores' }))

    expect(screen.getAllByRole('radio')).toHaveLength(25)
    expect(
      screen.queryByRole('button', { name: 'Mostrar versões anteriores' }),
    ).not.toBeInTheDocument()
  })

  it('needs a selected version before restoring', () => {
    renderPanel({ versions: [older, newer] })

    expect(screen.getByRole('button', { name: 'Restaurar versão' })).toBeDisabled()
  })

  it('asks for confirmation, restores the selected version and announces it', async () => {
    const onRestore = vi.fn(async () => {})
    renderPanel({ versions: [older, newer], onRestore })

    fireEvent.click(screen.getByRole('radio', { name: /09:00:00/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar versão' }))

    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByRole('heading', {
        name: 'Restaurar versão de 10/11/2026 às 09:00:00?',
      }),
    ).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Restaurar versão' }))

    await waitFor(() => expect(onRestore).toHaveBeenCalledWith(older))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const announcement = screen.getByText(
      'Versão de 10/11/2026 às 09:00:00 restaurada. O código da sala foi atualizado.',
    )
    expect(announcement).toHaveAttribute('aria-live', 'polite')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restaurar versão' })).toBeDisabled()
  })

  it('keeps the dialog open with the mapped error when the restore fails', async () => {
    const onRestore = vi.fn(async () => {
      throw new ApiError(409, 'room_closed', 'Fechada.', 'req-1')
    })
    renderPanel({ versions: [older], onRestore })

    fireEvent.click(screen.getByRole('radio', { name: /09:00:00/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar versão' }))

    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Restaurar versão' }))

    await waitFor(() =>
      expect(within(dialog).getByRole('alert')).toHaveTextContent(
        'Esta sala foi encerrada: não é possível restaurar versões.',
      ),
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('blocks the restore of a closed room and explains why', () => {
    renderPanel({ versions: [older], canRestore: false })

    expect(screen.getByRole('radio', { name: /09:00:00/ })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Restaurar versão' })).toBeDisabled()
    expect(
      screen.getByText(/esta sala foi encerrada.*não é possível restaurar versões/i),
    ).toBeInTheDocument()
  })
})
