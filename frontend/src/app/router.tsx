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
const RoomListRoute = lazy(() => import('./routes/RoomListRoute'))
const JoinedRoomsRoute = lazy(() => import('./routes/JoinedRoomsRoute'))
const CodeEntryRoute = lazy(() => import('./routes/CodeEntryRoute'))
const JoinRoomRoute = lazy(() => import('./routes/JoinRoomRoute'))

// The fixture chunk is only reachable in development, so it never enters the
// production bundle.
const OwnerRoom = lazy(() =>
  import.meta.env.DEV ? import('./dev/DevOwnerRoomPage') : import('./routes/OwnerRoomRoute'),
)
const SpectatorRoom = lazy(() =>
  import.meta.env.DEV ? import('./dev/DevSpectatorRoomPage') : import('./routes/SpectatorRoomRoute'),
)

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>
}

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
          { index: true, element: withSuspense(<RoomListRoute />) },
          { path: 'joined', element: withSuspense(<JoinedRoomsRoute />) },
          { path: 'join', element: withSuspense(<CodeEntryRoute />) },
          { path: ':roomId/join', element: withSuspense(<JoinRoomRoute />) },
          { path: ':roomId', element: withSuspense(<OwnerRoom />) },
          { path: ':roomId/view', element: withSuspense(<SpectatorRoom />) },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/login" replace /> },
]

export const router = createBrowserRouter(routes)
