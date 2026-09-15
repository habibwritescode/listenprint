import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { createElement } from 'react'
import type { AuthSession } from '../auth/session.ts'
import { demoLibraryQueryOptions } from '../demo/demo-library-query.ts'
import { generateDemoLibrary } from '../demo/generate.ts'
import { createAppRouter } from '../router.ts'
import { createTestSession } from './auth-session.ts'

export const testLibrary = generateDemoLibrary({ trackCount: 300 })

interface RenderAppOptions {
  /** Defaults to a signed-out session with in-memory storage. */
  auth?: AuthSession
}

export function renderApp(url: string, { auth = createTestSession().session }: RenderAppOptions = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(demoLibraryQueryOptions.queryKey, testLibrary)
  const router = createAppRouter({ queryClient, auth, history: createMemoryHistory({ initialEntries: [url] }) })

  const view = render(createElement(QueryClientProvider, { client: queryClient }, createElement(RouterProvider, { router })))
  return { ...view, router, queryClient, auth }
}
