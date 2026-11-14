import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { Participant } from '../../features/membership'
import { RoomLayout } from './RoomLayout'

const PARTICIPANTS: Participant[] = [
  { nickname: 'Ana', role: 'owner' },
  { nickname: 'Bruno', role: 'viewer' },
]

function renderLayout(props: Partial<Parameters<typeof RoomLayout>[0]> = {}) {
  return render(
    <RoomLayout
      title="Sua sala"
      accessCode="K7M2QX"
      language="python"
      status="active"
      {...props}
    >
      <div>editor</div>
    </RoomLayout>,
  )
}

describe('RoomLayout', () => {
  it('renders the title as the page heading', () => {
    renderLayout()

    expect(screen.getByRole('heading', { level: 1, name: 'Sua sala' })).toBeInTheDocument()
  })

  it('shows the access code beside the title', () => {
    renderLayout()

    expect(screen.getByText('K7M2QX')).toBeInTheDocument()
  })

  it('offers a copy action for the access code', () => {
    renderLayout()

    expect(screen.getByRole('button', { name: /copiar código k7m2qx/i })).toBeInTheDocument()
  })

  it('explains the manual fallback when the clipboard is unavailable', async () => {
    renderLayout()

    fireEvent.click(screen.getByRole('button', { name: /copiar código k7m2qx/i }))

    expect(await screen.findByText(/não foi possível copiar/i)).toBeInTheDocument()
  })

  it('shows the language label', () => {
    renderLayout({ language: 'javascript' })

    expect(screen.getByText('JavaScript')).toBeInTheDocument()
  })

  it('shows the room status', () => {
    renderLayout()

    expect(screen.getByText('Aberta')).toBeInTheDocument()
  })

  it('does not show the read-only badge on an editable room', () => {
    renderLayout()

    expect(screen.queryByText(/somente leitura/i)).not.toBeInTheDocument()
  })

  it('shows the read-only badge and the notice', () => {
    renderLayout({
      readOnly: true,
      readOnlyNotice: 'Você está assistindo. Somente o dono da sala pode editar o código.',
    })

    expect(screen.getByText('Somente leitura')).toBeInTheDocument()
    expect(screen.getByText(/somente o dono da sala pode editar/i)).toBeInTheDocument()
  })

  it('renders the connection slot', () => {
    renderLayout({ connection: <span>Conectado</span> })

    expect(screen.getByText('Conectado')).toBeInTheDocument()
  })

  it('renders the actions slot', () => {
    renderLayout({ actions: <button type="button">Encerrar sala</button> })

    expect(screen.getByRole('button', { name: 'Encerrar sala' })).toBeInTheDocument()
  })

  it('replaces the language chip with the provided control', () => {
    renderLayout({ languageControl: <button type="button">Linguagem</button> })

    expect(screen.getByRole('button', { name: 'Linguagem' })).toBeInTheDocument()
    expect(screen.queryByText('Python')).not.toBeInTheDocument()
  })

  it('renders the editor as the main content', () => {
    renderLayout()

    expect(screen.getByText('editor')).toBeInTheDocument()
  })

  it('renders the participants panel with the names it receives', () => {
    renderLayout({ participants: PARTICIPANTS })

    expect(screen.getByRole('complementary', { name: 'Participantes' })).toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('Bruno')).toBeInTheDocument()
  })

  it('falls back to the live count when there are no names', () => {
    renderLayout({ participantCount: 3 })

    expect(screen.getByText('3 participantes conectados')).toBeInTheDocument()
  })
})
