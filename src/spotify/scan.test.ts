import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import type { Library } from '../library/types.ts'
import { SPOTIFY_TOKEN_URL } from '../auth/config.ts'
import { createTestSession, signedInStorage } from '../test/auth-session.ts'
import { makeArtist, makeTrack } from '../test/factories.ts'
import { recordRequests, server, setupSpotifyMocks } from '../test/msw-server.ts'
import { spotifyNetworkError } from '../test/spotify-handlers.ts'
import {
  SAVED_TRACKS_URL,
  failSavedTracksAt,
  savedTrackItems,
  savedTracksResponds,
} from '../test/spotify-library-handlers.ts'
import { createMemoryLibraryStore } from './library-store.ts'
import { createSpotifyRequest } from './request.ts'
import { createLibraryScan } from './scan.ts'
import type { ScanState } from './scan-machine.ts'

setupSpotifyMocks()

const START = Date.UTC(2026, 8, 17, 10)

function setUp({ signedIn = true, store = createMemoryLibraryStore(), tokenExpired = false } = {}) {
  const localStorage = signedInStorage(tokenExpired ? { expiresAt: 0 } : {})
  const { session } = signedIn ? createTestSession({ localStorage }) : createTestSession()
  let clock = START
  // Every read of the clock moves it a second, so each page appears to take time.
  const now = vi.fn(() => (clock += 1_000))
  const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined)
  const fetchWithMocks: typeof fetch = (input, init) => fetch(input, init)
  const request = createSpotifyRequest({ auth: session, fetch: fetchWithMocks, sleep, random: () => 0.5 })
  const onLibrary = vi.fn<(library: Library) => void>()
  const scan = createLibraryScan({ request, store, now, onLibrary })
  const states: ScanState[] = []
  scan.subscribe(() => states.push(scan.getState()))
  return { scan, store, onLibrary, states, session }
}

function offsets(requests: { url: string }[]) {
  return requests
    .filter((request) => request.url.startsWith(SAVED_TRACKS_URL))
    .map((request) => Number(new URL(request.url).searchParams.get('offset')))
}

describe('createLibraryScan', () => {
  it('reads every page, saves the library newest first, and hands it over', async () => {
    const items = savedTrackItems(120)
    server.use(savedTracksResponds(items))
    const requests = recordRequests()
    const { scan, store, onLibrary } = setUp()

    await scan.start('initial')

    expect(offsets(requests)).toEqual([0, 50, 100])
    expect(requests.every((request) => new URL(request.url).searchParams.get('limit') === '50')).toBe(true)
    const saved = await store.loadLibrary()
    expect(saved?.source).toBe('spotify')
    expect(saved?.tracks.map((track) => track.name)).toEqual(items.map((item) => item.track.name))
    // The scan's end time from the injected clock, which starts at 10:00 UTC.
    expect(saved?.fetchedAt).toMatch(/^2026-09-17T10:00:\d\d\.000Z$/)
    expect(onLibrary).toHaveBeenCalledExactlyOnceWith(saved)
    expect(await store.loadPartialScan()).toBeNull()
    expect(scan.getState()).toEqual({ status: 'idle' })
  })

  it('reports progress in tracks, with an estimate from the pages so far', async () => {
    server.use(savedTracksResponds(savedTrackItems(120)))
    const { scan, states } = setUp()

    await scan.start('initial')

    const scanning = states.filter((state) => state.status === 'scanning')
    expect(scanning[0]).toMatchObject({ kind: 'initial', read: 0, total: null, estimateMs: null })
    expect(scanning.map((state) => [state.read, state.total])).toEqual([
      [0, null],
      [50, 120],
      [100, 120],
    ])
    // Two pages left after the first, at the first page's time.
    const afterFirst = scanning[1]
    expect(afterFirst.status === 'scanning' && afterFirst.estimateMs).toBeGreaterThan(0)
    const afterSecond = scanning[2]
    if (afterFirst.status !== 'scanning' || afterSecond.status !== 'scanning') throw new Error('not scanning')
    expect(afterSecond.estimateMs).toBeLessThan(afterFirst.estimateMs ?? 0)
  })

  it('finishes an empty library after one request', async () => {
    server.use(savedTracksResponds([]))
    const requests = recordRequests()
    const { scan, store } = setUp()

    await scan.start('initial')

    expect(offsets(requests)).toEqual([0])
    expect((await store.loadLibrary())?.tracks).toEqual([])
  })

  // The old app kept nothing when a scan failed, so every failure meant starting over.
  it('keeps the pages read before a failure, and resumes from the failed page only', async () => {
    const items = savedTrackItems(120)
    server.use(failSavedTracksAt(100, 403, { once: true }), savedTracksResponds(items))
    const requests = recordRequests()
    const { scan, store, onLibrary } = setUp()

    await scan.start('initial')

    expect(scan.getState()).toEqual({
      status: 'interrupted',
      kind: 'initial',
      read: 100,
      total: 120,
      reason: 'forbidden',
      retryAfterMs: null,
    })
    expect(await store.loadPartialScan()).toMatchObject({ nextOffset: 100, total: 120 })
    expect(onLibrary).not.toHaveBeenCalled()

    await scan.resume('initial')

    expect(offsets(requests)).toEqual([0, 50, 100, 100])
    expect((await store.loadLibrary())?.tracks).toHaveLength(120)
    expect(scan.getState()).toEqual({ status: 'idle' })
  })

  it.each([
    ['a long rate limit', 429, { 'Retry-After': '300' }, 'rateLimited', 300_000],
    ['a server outage', 503, {}, 'unavailable', null],
    ['a refused request', 404, {}, 'failed', null],
  ] as const)('interrupts on %s with the reason', async (_case, status, headers, reason, retryAfterMs) => {
    server.use(failSavedTracksAt(50, status, { headers }), savedTracksResponds(savedTrackItems(120)))
    const { scan } = setUp()

    await scan.start('initial')

    expect(scan.getState()).toMatchObject({ status: 'interrupted', read: 50, reason, retryAfterMs })
  })

  it('interrupts with the quota reason when the quota is used up', async () => {
    server.use(
      http.get(SAVED_TRACKS_URL, () =>
        HttpResponse.json({ error: { status: 429, reason: 'QUOTA_EXCEEDED' } }, { status: 429 }),
      ),
    )
    const { scan } = setUp()

    await scan.start('initial')

    expect(scan.getState()).toMatchObject({ status: 'interrupted', read: 0, total: null, reason: 'quota' })
  })

  it('interrupts with the network reason when requests never arrive', async () => {
    server.use(failSavedTracksAt(0, 'network'))
    const { scan } = setUp()

    await scan.start('initial')

    expect(scan.getState()).toMatchObject({ status: 'interrupted', reason: 'network' })
  })

  // A transient failure refreshing the token is a network problem, not a reason to sign out or start over.
  it('interrupts with the network reason when the token cannot be refreshed for a network error', async () => {
    server.use(spotifyNetworkError(SPOTIFY_TOKEN_URL))
    const { scan, session } = setUp({ tokenExpired: true })

    await scan.start('initial')

    expect(scan.getState()).toMatchObject({ status: 'interrupted', reason: 'network' })
    expect(session.getState().status).toBe('signedIn')
  })

  it('interrupts as failed when the progress cannot be saved', async () => {
    server.use(savedTracksResponds(savedTrackItems(120)))
    const full = () => Promise.reject(new DOMException('full', 'QuotaExceededError'))
    const store = { ...createMemoryLibraryStore(), savePartialScan: full }
    const { scan } = setUp({ store })

    await scan.start('initial')

    expect(scan.getState()).toMatchObject({ status: 'interrupted', reason: 'failed' })
  })

  it('finishes early when the library shrinks during the scan', async () => {
    const items = savedTrackItems(50)
    server.use(
      http.get(SAVED_TRACKS_URL, ({ request }) => {
        const offset = Number(new URL(request.url).searchParams.get('offset'))
        return HttpResponse.json({ items: offset === 0 ? items : [], total: 120 })
      }),
    )
    const requests = recordRequests()
    const { scan, store } = setUp()

    await scan.start('initial')

    expect(offsets(requests)).toEqual([0, 50])
    expect((await store.loadLibrary())?.tracks).toHaveLength(50)
  })

  it('interrupts as failed when a page is not a page', async () => {
    server.use(http.get(SAVED_TRACKS_URL, () => HttpResponse.json({ items: 'none', total: 3 })))
    const { scan } = setUp()

    await scan.start('initial')

    expect(scan.getState()).toMatchObject({ status: 'interrupted', reason: 'failed' })
  })

  it('stops after the current request when cancelled, and resumes from there', async () => {
    server.use(savedTracksResponds(savedTrackItems(120)))
    const requests = recordRequests()
    const { scan, store } = setUp()
    let cancelled = false
    scan.subscribe(() => {
      const state = scan.getState()
      if (!cancelled && state.status === 'scanning' && state.read === 50) {
        cancelled = true
        scan.cancel()
      }
    })

    await scan.start('initial')

    expect(scan.getState()).toMatchObject({ status: 'interrupted', read: 50, reason: 'cancelled' })
    expect(offsets(requests)).toEqual([0])

    await scan.resume('initial')

    expect(offsets(requests)).toEqual([0, 50, 100])
    expect((await store.loadLibrary())?.tracks).toHaveLength(120)
  })

  it('ignores cancel when nothing is running, so the next scan is not cancelled', async () => {
    server.use(savedTracksResponds(savedTrackItems(60)))
    const { scan, store } = setUp()

    scan.cancel()
    await scan.start('initial')

    expect((await store.loadLibrary())?.tracks).toHaveLength(60)
  })

  it('keeps the previous library until a refresh completes, then replaces it', async () => {
    const store = createMemoryLibraryStore()
    const tracks = [makeTrack({ artists: [makeArtist()] })]
    const previous: Library = { source: 'spotify', fetchedAt: '2026-01-01T00:00:00.000Z', tracks }
    await store.saveLibrary(previous)
    server.use(savedTracksResponds(savedTrackItems(120)))
    const { scan } = setUp({ store })
    const libraryDuringScan: Array<Library | null> = []
    scan.subscribe(() => {
      if (scan.getState().status !== 'scanning') return
      void store.loadLibrary().then((library) => libraryDuringScan.push(library))
    })

    await scan.start('refresh')

    expect(libraryDuringScan.length).toBeGreaterThan(0)
    expect(libraryDuringScan.every((library) => library?.fetchedAt === previous.fetchedAt)).toBe(true)
    expect((await store.loadLibrary())?.tracks).toHaveLength(120)
  })

  // Cancelling a refresh goes back to the ranking already on screen; there is nothing to resume.
  it('drops a cancelled refresh and returns to idle with the previous library', async () => {
    const store = createMemoryLibraryStore()
    const previous: Library = { source: 'spotify', fetchedAt: '2026-01-01T00:00:00.000Z', tracks: [] }
    await store.saveLibrary(previous)
    server.use(savedTracksResponds(savedTrackItems(120)))
    const { scan } = setUp({ store })
    scan.subscribe(() => {
      const state = scan.getState()
      if (state.status === 'scanning' && state.read === 50) scan.cancel()
    })

    await scan.start('refresh')

    expect(scan.getState()).toEqual({ status: 'idle' })
    expect(await store.loadPartialScan()).toBeNull()
    expect(await store.loadLibrary()).toEqual(previous)
  })

  // Likes added during a scan shift later pages by one, so the last track of a page can come back on the next.
  it('counts a track once when a shifted page repeats it', async () => {
    const items = savedTrackItems(100)
    const shifted = [...items.slice(0, 50), items[49], ...items.slice(50)]
    server.use(savedTracksResponds(shifted))
    const { scan, store } = setUp()

    await scan.start('initial')

    expect((await store.loadLibrary())?.tracks).toHaveLength(100)
  })

  it('ignores a second start while scanning', async () => {
    server.use(savedTracksResponds(savedTrackItems(60)))
    const requests = recordRequests()
    const { scan } = setUp()

    await Promise.all([scan.start('initial'), scan.start('initial')])

    expect(offsets(requests)).toEqual([0, 50])
  })

  it('offers to resume a scan left unfinished by an earlier visit', async () => {
    const store = createMemoryLibraryStore()
    await store.savePartialScan({
      tracks: [makeTrack({ artists: [makeArtist()] })],
      nextOffset: 50,
      total: 120,
      startedAt: '2026-09-16T10:00:00.000Z',
    })
    const { scan } = setUp({ store })

    await scan.restore('initial')

    expect(scan.getState()).toEqual({
      status: 'interrupted',
      kind: 'initial',
      read: 1,
      total: 120,
      reason: 'closed',
      retryAfterMs: null,
    })
  })

  it('leaves a running scan alone when asked to restore', async () => {
    const store = createMemoryLibraryStore()
    server.use(savedTracksResponds(savedTrackItems(120)))
    const { scan } = setUp({ store })
    const restored: ScanState[] = []
    let restoring: Promise<void> | null = null
    scan.subscribe(() => {
      const state = scan.getState()
      if (!restoring && state.status === 'scanning' && state.read === 50) {
        restoring = scan.restore('initial').then(() => void restored.push(scan.getState()))
      }
    })

    await scan.start('initial')
    await restoring

    expect(restored).toHaveLength(1)
    expect(restored[0].status).not.toBe('interrupted')
    expect((await store.loadLibrary())?.tracks).toHaveLength(120)
  })

  it('stays idle when there is nothing to restore', async () => {
    const { scan, states } = setUp()

    await scan.restore('initial')

    expect(scan.getState()).toEqual({ status: 'idle' })
    expect(states).toEqual([])
  })

  it('goes back to idle, keeping nothing, when the user is signed out', async () => {
    const { scan, store } = setUp({ signedIn: false })

    await scan.start('initial')

    expect(scan.getState()).toEqual({ status: 'idle' })
    expect(await store.loadPartialScan()).toBeNull()
  })

  it('stops notifying a listener after it unsubscribes', async () => {
    server.use(savedTracksResponds([]))
    const { scan } = setUp()
    const listener = vi.fn()
    scan.subscribe(listener)()

    await scan.start('initial')

    expect(listener).not.toHaveBeenCalled()
  })
})
