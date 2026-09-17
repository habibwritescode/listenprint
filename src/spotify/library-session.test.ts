import { QueryClient } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { TOKENS_KEY } from '../auth/token-storage.ts'
import { createTestSession, returnFromSpotify, signedInStorage } from '../test/auth-session.ts'
import { createTestLibrarySession, spotifyLibrary, storeWithLibrary } from '../test/library-session.ts'
import { makeArtist, makeTrack } from '../test/factories.ts'
import { recordRequests, server, setupSpotifyMocks } from '../test/msw-server.ts'
import {
  ARTIST_URL,
  SAVED_TRACKS_URL,
  artistResponds,
  savedTrackItems,
  savedTracksResponds,
} from '../test/spotify-library-handlers.ts'
import { createLibrarySession } from './library-session.ts'
import { createMemoryLibraryStore } from './library-store.ts'
import {
  ARTIST_DETAILS_QUERY_KEY,
  LIBRARY_QUERY_KEY,
  artistDetailsQueryOptions,
  libraryQueryOptions,
} from './queries.ts'
import type { ScanState } from './scan-machine.ts'

setupSpotifyMocks()

function signedIn(store = createMemoryLibraryStore()) {
  const localStorage = signedInStorage()
  const auth = createTestSession({ localStorage })
  const queryClient = new QueryClient()
  const { session: library, loadModules } = createTestLibrarySession({ auth: auth.session, queryClient, store })
  return { ...auth, store, loadModules, queryClient, library }
}

async function until(check: () => boolean | Promise<boolean>) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (await check()) return
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error('condition not met')
}

describe('createLibrarySession', () => {
  it('reads the saved library and artist details through Query', async () => {
    const saved = spotifyLibrary()
    const store = await storeWithLibrary(saved)
    await store.saveArtistDetails('saved-artist-0', { details: null, fetchedAt: 1 })
    const { library, queryClient } = signedIn(store)

    expect(await queryClient.fetchQuery(libraryQueryOptions(library))).toEqual(saved)
    expect(await queryClient.fetchQuery(artistDetailsQueryOptions(library))).toEqual({
      'saved-artist-0': { details: null, fetchedAt: 1 },
    })
    expect(LIBRARY_QUERY_KEY).toEqual(['library', 'spotify'])
    expect(ARTIST_DETAILS_QUERY_KEY).toEqual(['artist-details', 'spotify'])
  })

  it('reports whether the store keeps the library, once it has opened', async () => {
    const { library, queryClient } = signedIn()
    expect(library.isPersistent()).toBeNull()

    await queryClient.fetchQuery(libraryQueryOptions(library))

    expect(library.isPersistent()).toBe(false)
  })

  // The landing page shouldn't download the scan code, and a saved library doesn't need it.
  it('loads the scan modules only when a scan starts', async () => {
    server.use(savedTracksResponds(savedTrackItems(10)), artistResponds({}))
    const { library, queryClient, loadModules } = signedIn(await storeWithLibrary())

    await queryClient.fetchQuery(libraryQueryOptions(library))
    expect(loadModules).not.toHaveBeenCalled()

    await library.startScan('refresh')
    expect(loadModules).toHaveBeenCalledTimes(1)
  })

  it('scans, publishes the new library, then fills in artist details as they arrive', async () => {
    server.use(
      savedTracksResponds(savedTrackItems(60, { artistCount: 2 })),
      artistResponds({ 'artist-0': { images: [{ url: 'https://i.scdn.co/image/a0', width: 320 }] } }),
    )
    const { library, queryClient } = signedIn()
    const states: ScanState['status'][] = []
    library.subscribe(() => states.push(library.getScanState().status))

    await library.startScan('initial')

    expect(queryClient.getQueryData(LIBRARY_QUERY_KEY)).toMatchObject({ source: 'spotify', tracks: expect.any(Array) })
    expect(states).toContain('scanning')
    expect(library.getScanState()).toEqual({ status: 'idle' })
    const details = () => queryClient.getQueryData<Record<string, unknown>>(ARTIST_DETAILS_QUERY_KEY)
    await until(() => details()?.['artist-1'] !== undefined)
    expect(queryClient.getQueryData(ARTIST_DETAILS_QUERY_KEY)).toMatchObject({
      'artist-0': { details: { imageUrl: 'https://i.scdn.co/image/a0' } },
      'artist-1': { details: null },
    })
  })

  it('resumes and cancels through the scan', async () => {
    server.use(savedTracksResponds(savedTrackItems(120)), artistResponds({}))
    const { library, store } = signedIn()
    let cancelled = false
    library.subscribe(() => {
      const state = library.getScanState()
      if (!cancelled && state.status === 'scanning' && state.read === 50) {
        cancelled = true
        library.cancelScan()
      }
    })

    await library.startScan('initial')
    expect(library.getScanState()).toMatchObject({ status: 'interrupted', reason: 'cancelled' })

    await library.resumeScan('initial')
    expect((await store.loadLibrary())?.tracks).toHaveLength(120)
  })

  it.each([
    ['nothing saved yet', false, 'initial'],
    ['an earlier library', true, 'refresh'],
  ] as const)('offers to resume a scan left unfinished, over %s', async (_case, hasLibrary, kind) => {
    const store = hasLibrary ? await storeWithLibrary() : createMemoryLibraryStore()
    const tracks = [makeTrack({ artists: [makeArtist()] })]
    await store.savePartialScan({ tracks, nextOffset: 50, total: 90, startedAt: '2026-09-16T10:00:00.000Z' })
    const { library, queryClient } = signedIn(store)

    await queryClient.fetchQuery(libraryQueryOptions(library))

    expect(library.getScanState()).toMatchObject({ status: 'interrupted', kind, reason: 'closed' })
  })

  it('deletes the saved library and forgets it when signing out', async () => {
    const { library, queryClient, store, session } = signedIn(await storeWithLibrary())
    await queryClient.fetchQuery(libraryQueryOptions(library))
    await store.saveArtistDetails('saved-artist-0', { details: null, fetchedAt: 1 })

    session.signOut()

    await until(async () => (await store.loadLibrary()) === null)
    expect(await store.loadArtistDetails()).toEqual({})
    expect(queryClient.getQueryData(LIBRARY_QUERY_KEY)).toBeUndefined()
  })

  it('follows a sign-out in another tab', async () => {
    const { library, queryClient, store, localStorage, emitStorageEvent } = signedIn(await storeWithLibrary())
    await queryClient.fetchQuery(libraryQueryOptions(library))

    localStorage.removeItem(TOKENS_KEY)
    emitStorageEvent(TOKENS_KEY)

    await until(async () => (await store.loadLibrary()) === null)
    expect(queryClient.getQueryData(LIBRARY_QUERY_KEY)).toBeUndefined()
  })

  // Otherwise the page in flight would be saved after the clear, leaving part of a library behind.
  it('keeps nothing when signing out while a page is on its way', async () => {
    const items = savedTrackItems(200)
    const { library, store, session } = signedIn()
    server.use(
      http.get(SAVED_TRACKS_URL, async ({ request }) => {
        const offset = Number(new URL(request.url).searchParams.get('offset'))
        if (offset === 50) {
          session.signOut()
          await new Promise((resolve) => setTimeout(resolve, 20))
        }
        return HttpResponse.json({ items: items.slice(offset, offset + 50), total: items.length })
      }),
    )

    await library.startScan('initial')

    await until(async () => library.getScanState().status === 'idle')
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(await store.loadPartialScan()).toBeNull()
    expect(await store.loadLibrary()).toBeNull()
  })

  // A scan whose last page lands after sign-out must not put the library back into the cache.
  it('keeps a finished library out of the cache when sign-out came first', async () => {
    const items = savedTrackItems(30)
    const { library, store, session, queryClient } = signedIn()
    server.use(
      http.get(SAVED_TRACKS_URL, async () => {
        session.signOut()
        await new Promise((resolve) => setTimeout(resolve, 20))
        return HttpResponse.json({ items, total: items.length })
      }),
    )

    await library.startScan('initial')
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(queryClient.getQueryData(LIBRARY_QUERY_KEY)).toBeUndefined()
    expect(await store.loadLibrary()).toBeNull()
  })

  it('keeps artist details out of the cache when sign-out came first', async () => {
    server.use(savedTracksResponds(savedTrackItems(10, { artistCount: 1 })))
    const { library, store, session, queryClient } = signedIn()
    let signingOut: Promise<void> | null = null
    server.use(
      http.get(ARTIST_URL, async () => {
        session.signOut()
        signingOut = new Promise((resolve) => setTimeout(resolve, 20))
        await signingOut
        return HttpResponse.json({ images: [] })
      }),
    )

    await library.startScan('initial')
    await until(() => signingOut !== null)
    await new Promise((resolve) => setTimeout(resolve, 60))

    expect(queryClient.getQueryData(ARTIST_DETAILS_QUERY_KEY)).toBeUndefined()
    expect(await store.loadArtistDetails()).toEqual({})
  })

  // Offline, the scan's code chunk can fail to download; the error reaches the caller, and sign-out still clears.
  it('rejects a scan whose code fails to load, and still clears on sign-out', async () => {
    const localStorage = signedInStorage()
    const { session } = createTestSession({ localStorage })
    const store = await storeWithLibrary()
    const library = createLibrarySession({
      auth: session,
      queryClient: new QueryClient(),
      openStore: async () => store,
      loadModules: () => Promise.reject(new TypeError('Failed to fetch dynamically imported module')),
      fetch,
      now: () => 0,
      sleep: async () => {},
      random: () => 0,
    })

    await expect(library.startScan('initial')).rejects.toThrow('Failed to fetch dynamically imported module')

    session.signOut()
    await until(async () => (await store.loadLibrary()) === null)
  })

  it('creates one scan when two starts race', async () => {
    server.use(savedTracksResponds(savedTrackItems(10)), artistResponds({}))
    const recorded = recordRequests()
    const { library } = signedIn()

    await Promise.all([library.startScan('initial'), library.startScan('initial')])

    expect(recorded.filter((request) => request.url.startsWith(SAVED_TRACKS_URL))).toHaveLength(1)
  })

  it('clears a library left by an earlier account when a new sign-in completes', async () => {
    const store = await storeWithLibrary()
    const { session, returnedState } = await returnFromSpotify()
    const queryClient = new QueryClient()
    const { session: library } = createTestLibrarySession({ auth: session, queryClient, store })

    await session.completeSignIn({ code: 'test-code', state: returnedState })

    expect(session.getState().status).toBe('signedIn')
    expect(await queryClient.fetchQuery(libraryQueryOptions(library))).toBeNull()
    expect(await store.loadLibrary()).toBeNull()
  })

  it('keeps the library when an app loads already signed in', async () => {
    const store = await storeWithLibrary()
    const { library, queryClient } = signedIn(store)

    expect(await queryClient.fetchQuery(libraryQueryOptions(library))).not.toBeNull()
  })

  it('stops notifying a listener after it unsubscribes', async () => {
    server.use(savedTracksResponds([]), artistResponds({}))
    const { library } = signedIn()
    let calls = 0
    library.subscribe(() => {
      calls += 1
    })()

    await library.startScan('initial')

    expect(calls).toBe(0)
  })
})
