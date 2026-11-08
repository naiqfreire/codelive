import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { AuthLayout } from './layouts/AuthLayout'
import { RouteFallback } from './RouteFallback'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))

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
  { path: '*', element: <Navigate to="/login" replace /> },
]

export const router = createBrowserRouter(routes)
