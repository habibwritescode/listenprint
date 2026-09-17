import type { QueryClient } from '@tanstack/react-query'
import type { AuthState } from '../auth/auth-machine.ts'
import type { AuthSession } from '../auth/session.ts'
import type { Library } from '../library/types.ts'
import type * as LibraryModules from './library-modules.ts'
import type { LibraryStore, SavedArtistDetails } from './library-store.ts'
import type { LibraryScan } from './scan.ts'
import type { ScanKind, ScanState } from './scan-machine.ts'

// Values, not imports: importing queries.ts would pull TanStack's queryOptions into this module's graph for nothing.
const LIBRARY_KEY = ['library', 'spotify'] as const
const ARTIST_DETAILS_KEY = ['artist-details', 'spotify'] as const

export interface LibrarySessionDeps {
  auth: AuthSession
  queryClient: QueryClient
  openStore: () => Promise<LibraryStore>
  loadModules: () => Promise<typeof LibraryModules>
  fetch: typeof fetch
  now: () => number
  sleep: (ms: number) => Promise<void>
  random: () => number
}

export interface LibrarySession {
  getScanState(): ScanState
  subscribe(listener: () => void): () => void
  /** `null` until the store has opened; `false` when the library won't outlive the tab. */
  isPersistent(): boolean | null
  /** The saved library, restoring an unfinished scan as interrupted so it can be resumed. */
  loadLibrary(): Promise<Library | null>
  loadArtistDetails(): Promise<Record<string, SavedArtistDetails>>
  startScan(kind: ScanKind): Promise<void>
  resumeScan(kind: ScanKind): Promise<void>
  cancelScan(): void
}

const IDLE: ScanState = { status: 'idle' }

// Sign-out ends the library; so does a new sign-in, whose account may not be the one that scanned it.
function endsLibrary(previous: AuthState, next: AuthState): boolean {
  return (
    (previous.status === 'signedIn' && next.status !== 'signedIn') ||
    (previous.status === 'completing' && next.status === 'signedIn')
  )
}

export function createLibrarySession(deps: LibrarySessionDeps): LibrarySession {
  const { auth, queryClient, now } = deps
  const listeners = new Set<() => void>()
  let storeOpening: Promise<LibraryStore> | null = null
  let persistent: boolean | null = null
  let scanState: ScanState = IDLE
  let scan: LibraryScan | null = null
  let stopFollowingScan: (() => void) | null = null
  // Bumped on every clear, so a scan or details pass from before it can't write into the cache afterwards.
  let generation = 0
  let clearing: Promise<void> = Promise.resolve()
  const inFlight = new Set<Promise<unknown>>()

  const notify = () => {
    for (const listener of listeners) listener()
  }

  const store = () =>
    (storeOpening ??= deps.openStore().then((opened) => {
      persistent = opened.persistent
      notify()
      return opened
    }))

  const track = <T>(work: Promise<T>): Promise<T> => {
    inFlight.add(work)
    void work.finally(() => inFlight.delete(work)).catch(() => {})
    return work
  }

  async function getScan(): Promise<LibraryScan> {
    const [modules, opened] = await Promise.all([deps.loadModules(), store()])
    if (scan) return scan
    const created = generation
    const request = modules.createSpotifyRequest({ auth, fetch: deps.fetch, sleep: deps.sleep, random: deps.random })
    const current = modules.createLibraryScan({
      request,
      store: opened,
      now,
      onLibrary: (library) => {
        if (created !== generation) return
        queryClient.setQueryData(LIBRARY_KEY, library)
        const onSaved = (artistId: string, record: SavedArtistDetails) => {
          if (created !== generation) return
          queryClient.setQueryData<Record<string, SavedArtistDetails>>(ARTIST_DETAILS_KEY, (saved) => ({
            ...saved,
            [artistId]: record,
          }))
        }
        void track(modules.fetchTopArtistDetails({ request, store: opened, now, onSaved }, library.tracks))
      },
    })
    scan = current
    stopFollowingScan = current.subscribe(() => {
      scanState = current.getState()
      notify()
    })
    return current
  }

  async function clearLibrary() {
    generation += 1
    scan?.cancel()
    stopFollowingScan?.()
    scan = null
    stopFollowingScan = null
    scanState = IDLE
    notify()
    queryClient.removeQueries({ queryKey: LIBRARY_KEY })
    queryClient.removeQueries({ queryKey: ARTIST_DETAILS_KEY })
    // A page or artist in flight saves after it arrives; clearing only after that leaves nothing behind.
    await Promise.allSettled([...inFlight])
    await (await store()).clear()
  }

  let authState = auth.getState()
  auth.subscribe(() => {
    const next = auth.getState()
    if (endsLibrary(authState, next)) clearing = clearing.then(clearLibrary, clearLibrary)
    authState = next
  })

  const afterClearing = <T>(work: () => Promise<T>) => clearing.then(work)

  return {
    getScanState: () => scanState,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    isPersistent: () => persistent,
    loadLibrary: () =>
      afterClearing(async () => {
        const opened = await store()
        const [library, partial] = await Promise.all([opened.loadLibrary(), opened.loadPartialScan()])
        if (partial && scanState.status === 'idle') await (await getScan()).restore(library ? 'refresh' : 'initial')
        return library
      }),
    loadArtistDetails: () => afterClearing(async () => (await store()).loadArtistDetails()),
    startScan: (kind) => track(afterClearing(async () => (await getScan()).start(kind))),
    resumeScan: (kind) => track(afterClearing(async () => (await getScan()).resume(kind))),
    cancelScan: () => scan?.cancel(),
  }
}
