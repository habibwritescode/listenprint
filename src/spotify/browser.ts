import type { QueryClient } from '@tanstack/react-query'
import type { AuthSession } from '../auth/session.ts'
import { createLibrarySession } from './library-session.ts'
import type { LibrarySession } from './library-session.ts'

/** The parts of `window` the library uses; `window` itself satisfies it. */
export interface LibraryEnvironment {
  readonly indexedDB?: IDBFactory
  fetch: typeof fetch
}

interface BrowserLibraryOptions {
  auth: AuthSession
  queryClient: QueryClient
  env: LibraryEnvironment
}

export function createBrowserLibrarySession({ auth, queryClient, env }: BrowserLibraryOptions): LibrarySession {
  return createLibrarySession({
    auth,
    queryClient,
    // Both behind import(): a signed-out visitor never downloads the store or the scan code.
    openStore: async () => (await import('./indexeddb-store.ts')).openLibraryStore(() => env.indexedDB),
    loadModules: () => import('./library-modules.ts'),
    fetch: (input, init) => env.fetch(input, init),
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    random: () => Math.random(),
  })
}
