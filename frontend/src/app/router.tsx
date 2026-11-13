import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { GuestRoute, ProtectedRoute } from '../features/auth'
import { AppShell } from './layouts/AppShell'
import { AuthLayout } from './layouts/AuthLayout'
import { RouteFallback } from './RouteFallback'

const LoginRoute = lazy(() => import('./routes/LoginRoute'))
const RegisterRoute = lazy(() => import('./routes/RegisterRoute'))

// The fixture chunk is only reachable in development, so it never enters the
// production bundle.
const RoomListPage = lazy(() =>
  import.meta.env.DEV ? import('./dev/DevRoomListPage') : import('./pages/RoomListPage'),
)
const OwnerRoomPage = lazy(() =>
  import.meta.env.DEV ? import('./dev/DevOwnerRoomPage') : import('./pages/OwnerRoomPage'),
)
const SpectatorRoomPage = lazy(() =>
  import.meta.env.DEV ? import('./dev/DevSpectatorRoomPage') : import('./pages/SpectatorRoomPage'),
)
// In production this route is not registered, so the fallback below is never
// rendered; it exists only to keep the dev chunk out of the production bundle.
const JoinEntryPage = lazy(() =>
  import.meta.env.DEV ? import('./dev/DevJoinPage') : import('./pages/RoomListPage'),
)

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>
}

// `/rooms/join` only exists while reviewing the modal; the real spectator route
// belongs to the join flow task.
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [{ path: 'join', element: withSuspense(<JoinEntryPage />) }]
  : []

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <GuestRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { index: true, element: <Navigate to="/login" replace /> },
          { path: 'login', element: withSuspense(<LoginRoute />) },
          { path: 'register', element: withSuspense(<RegisterRoute />) },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/rooms',
        element: <AppShell />,
        children: [
          { index: true, element: withSuspense(<RoomListPage />) },
          ...devRoutes,
          { path: ':roomId', element: withSuspense(<OwnerRoomPage />) },
          { path: ':roomId/view', element: withSuspense(<SpectatorRoomPage />) },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/login" replace /> },
]

export const router = createBrowserRouter(routes)
