import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { RoomListTabs } from './RoomListTabs'

function renderTabs(path = '/rooms') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RoomListTabs />
    </MemoryRouter>,
  )
}

describe('RoomListTabs', () => {
  it('offers the two room filters', () => {
    renderTabs()

    expect(screen.getByRole('navigation', { name: 'Filtro de salas' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Criadas por mim' })).toHaveAttribute('href', '/rooms')
    expect(screen.getByRole('link', { name: 'Participei' })).toHaveAttribute(
      'href',
      '/rooms/joined',
    )
  })

  it('marks the owned rooms filter as current on /rooms', () => {
    renderTabs('/rooms')

    expect(screen.getByRole('link', { name: 'Criadas por mim' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Participei' })).not.toHaveAttribute('aria-current')
  })

  it('marks the joined rooms filter as current on /rooms/joined', () => {
    renderTabs('/rooms/joined')

    expect(screen.getByRole('link', { name: 'Participei' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Criadas por mim' })).not.toHaveAttribute(
      'aria-current',
    )
  })
})
