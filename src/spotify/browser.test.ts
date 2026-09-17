import { QueryClient } from '@tanstack/react-query'
import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it, vi } from 'vitest'
import { createTestSession, signedInStorage } from '../test/auth-session.ts'
import { server, setupSpotifyMocks } from '../test/msw-server.ts'
import {
  SAVED_TRACKS_URL,
  artistResponds,
  respondOnceWith,
  savedTrackItems,
  savedTracksResponds,
} from '../test/spotify-library-handlers.ts'
import { createBrowserLibrarySession } from './browser.ts'
import { libraryQueryOptions } from './queries.ts'

setupSpotifyMocks()

function env(indexedDB: () => IDBFactory | undefined) {
  return {
    get indexedDB() {
      return indexedDB()
    },
    fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
  }
}

describe('createBrowserLibrarySession', () => {
  it('scans into IndexedDB and reads the library back on the next visit', async () => {
    server.use(savedTracksResponds(savedTrackItems(20)), artistResponds({}))
    const indexedDB = new IDBFactory()
    const { session: auth } = createTestSession({ localStorage: signedInStorage() })
    const first = createBrowserLibrarySession({ auth, queryClient: new QueryClient(), env: env(() => indexedDB) })

    await first.startScan('initial')

    const queryClient = new QueryClient()
    const next = createBrowserLibrarySession({ auth, queryClient, env: env(() => indexedDB) })
    const library = await queryClient.fetchQuery(libraryQueryOptions(next))
    expect(library?.tracks).toHaveLength(20)
    expect(next.isPersistent()).toBe(true)
  })

  it('waits and retries with the real timer and randomness', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    server.use(respondOnceWith(SAVED_TRACKS_URL, 503), savedTracksResponds(savedTrackItems(5)), artistResponds({}))
    const { session: auth } = createTestSession({ localStorage: signedInStorage() })
    const queryClient = new QueryClient()
    const library = createBrowserLibrarySession({ auth, queryClient, env: env(() => new IDBFactory()) })

    await library.startScan('initial')

    expect(queryClient.getQueryData<{ tracks: unknown[] }>(['library', 'spotify'])?.tracks).toHaveLength(5)
    vi.restoreAllMocks()
  })

  // Some browsers throw from the indexedDB property itself when site data is blocked.
  it('keeps the library in memory when reaching IndexedDB throws', async () => {
    const { session: auth } = createTestSession({ localStorage: signedInStorage() })
    const queryClient = new QueryClient()
    const blocked = env(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    const library = createBrowserLibrarySession({ auth, queryClient, env: blocked })

    await queryClient.fetchQuery(libraryQueryOptions(library))

    expect(library.isPersistent()).toBe(false)
  })
})
