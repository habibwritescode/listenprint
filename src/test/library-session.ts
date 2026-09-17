import type { QueryClient } from '@tanstack/react-query'
import { vi } from 'vitest'
import type { AuthSession } from '../auth/session.ts'
import type { Library } from '../library/types.ts'
import { createLibrarySession } from '../spotify/library-session.ts'
import * as libraryModules from '../spotify/library-modules.ts'
import { createMemoryLibraryStore } from '../spotify/library-store.ts'
import type { LibraryStore } from '../spotify/library-store.ts'
import { makeArtist, makeTrack } from './factories.ts'

export const LIBRARY_NOW = Date.UTC(2026, 8, 17, 12)

interface TestLibrarySessionOptions {
  auth: AuthSession
  queryClient: QueryClient
  store?: LibraryStore
}

/** A library session with a memory store, the scan modules loaded directly, no real waiting, and a fixed clock. */
export function createTestLibrarySession({
  auth,
  queryClient,
  store = createMemoryLibraryStore(),
}: TestLibrarySessionOptions) {
  const loadModules = vi.fn(async () => libraryModules)
  const openStore = vi.fn(async () => store)
  const session = createLibrarySession({
    auth,
    queryClient,
    openStore,
    loadModules,
    fetch: (input, init) => fetch(input, init),
    now: () => LIBRARY_NOW,
    sleep: async () => {},
    random: () => 0.5,
  })
  return { session, store, loadModules, openStore }
}

/** A saved Spotify library with `trackCount` tracks by three artists. */
export function spotifyLibrary(trackCount = 30): Library {
  const artists = [0, 1, 2].map((index) => makeArtist({ id: `saved-artist-${index}`, name: `Saved Artist ${index}` }))
  return {
    source: 'spotify',
    fetchedAt: '2026-09-10T08:00:00.000Z',
    tracks: Array.from({ length: trackCount }, (_, index) =>
      makeTrack({ artists: [artists[index % 3]], albumName: `Saved Album ${index % 4}` }),
    ),
  }
}

export async function storeWithLibrary(library: Library = spotifyLibrary()) {
  const store = createMemoryLibraryStore()
  await store.saveLibrary(library)
  return store
}
