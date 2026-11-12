import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { AppShell } from './layouts/AppShell'
import { AuthLayout } from './layouts/AuthLayout'
import { RouteFallback } from './RouteFallback'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))

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

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AuthLayout />,
    children: [
      { index: true, element: <Navigate to="/login" replace /> },
      { path: 'login', element: withSuspense(<LoginPage />) },
      { path: 'register', element: withSuspense(<RegisterPage />) },
    ],
  },
  {
    path: '/rooms',
    element: <AppShell />,
    children: [
      { index: true, element: withSuspense(<RoomListPage />) },
      { path: ':roomId', element: withSuspense(<OwnerRoomPage />) },
      { path: ':roomId/view', element: withSuspense(<SpectatorRoomPage />) },
    ],
  },
  { path: '*', element: <Navigate to="/login" replace /> },
]

export const router = createBrowserRouter(routes)
