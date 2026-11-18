import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '../features/auth'
import type { AuthApi } from '../features/auth'
import { anonymousAuthError, createFakeAuthApi } from '../test/auth'
import { QueryProvider } from '../test/query'
import { installSilentWebSocket } from '../test/websocket'
import { routes } from './router'

const ROOM_ID = '11111111-1111-1111-1111-111111111111'

const ROOM_RESPONSE = {
  id: ROOM_ID,
  access_code: 'K7M2QX',
  language: 'python',
  status: 'active',
  created_at: '2026-11-09T17:30:00Z',
}

const JOINED_ROOM_RESPONSE = {
  ...ROOM_RESPONSE,
  room_id: ROOM_ID,
  user_id: '22222222-2222-2222-2222-222222222222',
  role: 'viewer',
  is_anonymous: false,
  nickname: 'Ana',
  joined_at: '2026-11-09T17:35:00Z',
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input)
    let body: unknown = []

    if (url.includes('/api/rooms/mine')) {
      body = [ROOM_RESPONSE]
    } else if (url.includes('/api/rooms/joined')) {
      body = { items: [JOINED_ROOM_RESPONSE] }
    }

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  installSilentWebSocket()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderRoute(path: string, api: AuthApi = createFakeAuthApi()) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <QueryProvider>
      <AuthProvider api={api}>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryProvider>,
  )
}

function anonymousApi(): AuthApi {
  return createFakeAuthApi({
    me: async () => {
      throw anonymousAuthError()
    },
  })
}

describe('router', () => {
  it('redirects the root path to the login page for anonymous visitors', async () => {
    renderRoute('/', anonymousApi())

    expect(await screen.findByRole('heading', { name: /entrar/i })).toBeInTheDocument()
  })

  it('renders the register page for anonymous visitors', async () => {
    renderRoute('/register', anonymousApi())

    expect(await screen.findByRole('heading', { name: /criar conta/i })).toBeInTheDocument()
  })

  it('does not render the shell navigation on the login page', async () => {
    renderRoute('/login', anonymousApi())

    expect(await screen.findByRole('heading', { name: /entrar/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /minhas salas/i })).not.toBeInTheDocument()
  })

  it('sends an anonymous visitor away from a private route', async () => {
    renderRoute('/rooms', anonymousApi())

    expect(await screen.findByRole('heading', { name: /entrar/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /minhas salas/i })).not.toBeInTheDocument()
  })

  it('renders the room list inside the shell for an authenticated visitor', async () => {
    renderRoute('/rooms')

    expect(
      await screen.findByRole('heading', { level: 1, name: /minhas salas/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /minhas salas/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('renders the joined rooms list inside the shell for an authenticated visitor', async () => {
    renderRoute('/rooms/joined')

    expect(
      await screen.findByRole('heading', { level: 1, name: /salas que participei/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /minhas salas/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Participei' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('sends an anonymous visitor away from the joined rooms list', async () => {
    renderRoute('/rooms/joined', anonymousApi())

    expect(await screen.findByRole('heading', { name: /entrar/i })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: /salas que participei/i }),
    ).not.toBeInTheDocument()
  })

  it('sends an authenticated visitor from the login page to the room list', async () => {
    renderRoute('/login')

    expect(
      await screen.findByRole('heading', { level: 1, name: /minhas salas/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /entrar/i })).not.toBeInTheDocument()
  })

  it('renders the access-code step inside the shell for an authenticated visitor', async () => {
    renderRoute('/rooms/join')

    expect(
      await screen.findByRole('heading', { level: 1, name: /entrar com código/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /entrar com código/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('renders the access-code step for an anonymous visitor', async () => {
    renderRoute('/rooms/join', anonymousApi())

    expect(
      await screen.findByRole('heading', { level: 1, name: /entrar com código/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /minhas salas/i })).not.toBeInTheDocument()
  })

  it('guards the identification step when it is opened directly', async () => {
    renderRoute(`/rooms/${ROOM_ID}/join`, anonymousApi())

    expect(await screen.findByRole('heading', { name: /código necessário/i })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders an owner room resolved from the API', async () => {
    renderRoute(`/rooms/${ROOM_ID}`)

    expect(await screen.findByRole('heading', { name: /sua sala/i })).toBeInTheDocument()
  })

  it('renders a read-only spectator room resolved from the joined list', async () => {
    renderRoute(`/rooms/${ROOM_ID}/view`)

    expect(await screen.findByRole('heading', { name: /sala ao vivo/i })).toBeInTheDocument()

    const editor = await screen.findByRole('textbox', { name: /código da sala/i })
    expect(editor).toHaveAttribute('contenteditable', 'false')
  })

  it('asks the anonymous spectator for the code when the navigation state is missing', async () => {
    renderRoute(`/rooms/${ROOM_ID}/view`, anonymousApi())

    expect(await screen.findByRole('heading', { name: /sala não encontrada/i })).toBeInTheDocument()
    expect(screen.getByText(/informe o código da sala/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /minhas salas/i })).not.toBeInTheDocument()
  })

  it('shows the not-found state for an unknown room', async () => {
    renderRoute(`/rooms/00000000-0000-0000-0000-000000000000`)

    expect(await screen.findByText(/sala não encontrada/i)).toBeInTheDocument()
  })
})