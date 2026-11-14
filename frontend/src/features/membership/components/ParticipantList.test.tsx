import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ParticipantList } from './ParticipantList'
import type { Participant } from '../types'

const ANA: Participant = { nickname: 'Ana', role: 'owner' }
const BRUNO: Participant = { nickname: 'Bruno', role: 'viewer' }

describe('ParticipantList', () => {
  it('has an accessible name', () => {
    render(<ParticipantList />)

    expect(screen.getByRole('complementary', { name: 'Participantes' })).toBeInTheDocument()
  })

  it('renders every nickname', () => {
    render(<ParticipantList participants={[ANA, BRUNO]} />)

    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('Bruno')).toBeInTheDocument()
  })

  it('marks the owner and leaves the viewers unmarked', () => {
    render(<ParticipantList participants={[ANA, BRUNO]} />)

    const items = screen.getAllByRole('listitem')

    expect(items[0]).toHaveTextContent('Ana')
    expect(items[0]).toHaveTextContent(/dono/i)
    expect(items[1]).toHaveTextContent('Bruno')
    expect(items[1]).not.toHaveTextContent(/dono/i)
  })

  it('falls back to the empty message when there is no participant', () => {
    render(<ParticipantList />)

    expect(screen.getByText(/nenhum participante conectado/i)).toBeInTheDocument()
  })

  it('uses the singular for one connected participant', () => {
    render(<ParticipantList count={1} />)

    expect(screen.getByText('1 participante conectado')).toBeInTheDocument()
  })

  it('uses the plural for several connected participants', () => {
    render(<ParticipantList count={4} />)

    expect(screen.getByText('4 participantes conectados')).toBeInTheDocument()
  })

  it('announces the count politely', () => {
    render(<ParticipantList count={3} />)

    expect(screen.getByText('3 participantes conectados')).toHaveAttribute('aria-live', 'polite')
  })

  it('does not show the count when the names are available', () => {
    render(<ParticipantList participants={[ANA, BRUNO]} count={2} />)

    expect(screen.queryByText(/conectado/i)).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})
