import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { createElement } from 'react'
import type { AuthSession } from '../auth/session.ts'
import { demoLibraryQueryOptions } from '../demo/demo-library-query.ts'
import { generateDemoLibrary } from '../demo/generate.ts'
import { createAppRouter } from '../router.ts'
import type { LibraryStore } from '../spotify/library-store.ts'
import { createTestSession } from './auth-session.ts'
import { createTestLibrarySession } from './library-session.ts'

export const testLibrary = generateDemoLibrary({ trackCount: 300 })

interface RenderAppOptions {
  /** Defaults to a signed-out session with in-memory storage. */
  auth?: AuthSession
  /** The saved Spotify library; defaults to an empty memory store. */
  store?: LibraryStore
}

export function renderApp(url: string, { auth = createTestSession().session, store }: RenderAppOptions = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(demoLibraryQueryOptions.queryKey, testLibrary)
  const library = createTestLibrarySession({ auth, queryClient, store })
  const history = createMemoryHistory({ initialEntries: [url] })
  const router = createAppRouter({ queryClient, auth, library: library.session, history })

  const app = createElement(QueryClientProvider, { client: queryClient }, createElement(RouterProvider, { router }))
  const view = render(app)
  const { session: librarySession, store: libraryStore, loadModules } = library
  return { ...view, router, queryClient, auth, library: librarySession, store: libraryStore, loadModules }
}
