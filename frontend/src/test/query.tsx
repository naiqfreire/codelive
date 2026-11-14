/* eslint-disable react-refresh/only-export-components -- test-only helpers */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'

/** Fresh client per test: no retries, no cache sharing between cases. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

export function QueryProvider({
  client = createTestQueryClient(),
  children,
}: {
  client?: QueryClient
  children: ReactNode
}) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

export function renderWithQuery(
  ui: ReactElement,
  client: QueryClient = createTestQueryClient(),
): RenderResult & { client: QueryClient } {
  return {
    client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  }
}
