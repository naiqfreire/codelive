import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { RoomSummary } from '../../features/rooms'
import RoomListPage from './RoomListPage'

const ownedRooms: RoomSummary[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    accessCode: 'K7M2QX',
    language: 'python',
    status: 'active',
    createdAt: '2026-11-09T17:30:00Z',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    accessCode: 'B4T9RS',
    language: 'java',
    status: 'active',
    createdAt: '2026-11-08T17:30:00Z',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    accessCode: 'Z2Y8NM',
    language: 'javascript',
    status: 'closed',
    createdAt: '2026-11-07T17:30:00Z',
  },
]

const joinedRooms: RoomSummary[] = [
  {
    id: '44444444-4444-4444-4444-444444444444',
    accessCode: 'H5P1VC',
    language: 'c',
    status: 'active',
    createdAt: '2026-11-06T17:30:00Z',
  },
]

type PageProps = {
  ownedRooms?: RoomSummary[]
  joinedRooms?: RoomSummary[]
  isLoading?: boolean
  onCreateRoom?: () => void
}

function renderPage(
  {
    ownedRooms: owned = ownedRooms,
    joinedRooms: joined = joinedRooms,
    isLoading,
    onCreateRoom,
  }: PageProps = {},
  path = '/rooms',
) {
  const router = createMemoryRouter(
    [
      {
        path: '/rooms',
        element: (
          <RoomListPage
            ownedRooms={owned}
            joinedRooms={joined}
            isLoading={isLoading}
            onCreateRoom={onCreateRoom}
          />
        ),
      },
    ],
    { initialEntries: [path] },
  )

  return render(<RouterProvider router={router} />)
}

describe('RoomListPage', () => {
  it('renders one card per room', async () => {
    renderPage()

    expect(await screen.findAllByRole('heading', { level: 2 })).toHaveLength(3)
  })

  it('marks the mine tab as current by default', async () => {
    renderPage()

    expect(await screen.findByRole('link', { name: /^minhas$/i })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  it('renders the joined rooms from the query string', async () => {
    renderPage({}, '/rooms?tab=joined')

    expect(await screen.findByRole('heading', { name: 'H5P1VC' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'K7M2QX' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^participei$/i })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  it('shows the empty state for owned rooms', async () => {
    renderPage({ ownedRooms: [] })

    expect(await screen.findByText(/nenhuma sala ainda/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /criar sala/i })).toBeInTheDocument()
  })

  it('shows the empty state for joined rooms without a create action', async () => {
    renderPage({ ownedRooms: [], joinedRooms: [] }, '/rooms?tab=joined')

    expect(await screen.findByText(/ainda não participou/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /criar sala/i })).not.toBeInTheDocument()
  })

  it('announces loading with a status role', async () => {
    renderPage({ isLoading: true })

    expect(await screen.findByRole('status')).toHaveTextContent(/carregando salas/i)
  })

  it('summarizes the open and closed counts', async () => {
    renderPage()

    expect(await screen.findByText(/2 abertas/)).toBeInTheDocument()
    expect(screen.getByText(/1 encerrada/)).toBeInTheDocument()
  })

  it('calls onCreateRoom from the primary action', async () => {
    const onCreateRoom = vi.fn()

    renderPage({ onCreateRoom })
    fireEvent.click(await screen.findByRole('button', { name: /nova sala/i }))

    expect(onCreateRoom).toHaveBeenCalledTimes(1)
  })
})
