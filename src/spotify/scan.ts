import type { Library, LibraryTrack } from '../library/types.ts'
import type { LibraryStore, PartialScan } from './library-store.ts'
import { normalizeSavedTracks } from './normalize.ts'
import type { SpotifyRequest } from './request.ts'
import { SpotifyRequestError } from './request.ts'
import { PAGE_SIZE, interruptionFor, readPage, remainingEstimateMs } from './scan-machine.ts'
import type { ScanKind, ScanState } from './scan-machine.ts'

export interface LibraryScanDeps {
  request: SpotifyRequest
  store: LibraryStore
  now: () => number
  /** Called with each finished library, after it's saved. */
  onLibrary: (library: Library) => void
}

export interface LibraryScan {
  getState(): ScanState
  subscribe(listener: () => void): () => void
  /** Reads the library from the first page, replacing any unfinished scan. */
  start(kind: ScanKind): Promise<void>
  /** Continues an unfinished scan from its next page, or starts over when there is none. */
  resume(kind: ScanKind): Promise<void>
  /** Stops after the request in flight. */
  cancel(): void
  /** Shows an unfinished scan from an earlier visit as interrupted, so it can be resumed. */
  restore(kind: ScanKind): Promise<void>
}

// Likes added mid-scan shift later pages, which can repeat a track; the same track liked twice keeps both likes.
const trackKey = (track: LibraryTrack) => `${track.id}|${track.addedAt}`

export function createLibraryScan({ request, store, now, onLibrary }: LibraryScanDeps): LibraryScan {
  let state: ScanState = { status: 'idle' }
  let running = false
  let cancelRequested = false
  const listeners = new Set<() => void>()

  function setState(next: ScanState) {
    state = next
    for (const listener of listeners) listener()
  }

  async function run(kind: ScanKind, from: PartialScan | null) {
    const tracks = [...(from?.tracks ?? [])]
    const seen = new Set(tracks.map(trackKey))
    let offset = from?.nextOffset ?? 0
    let total = from?.total ?? null
    const startedAt = from?.startedAt ?? new Date(now()).toISOString()
    let pageTimeMs = 0
    let pages = 0
    setState({ status: 'scanning', kind, read: tracks.length, total, estimateMs: null })

    try {
      while (total === null || offset < total) {
        if (cancelRequested) {
          if (kind === 'refresh') {
            await store.discardPartialScan()
            setState({ status: 'idle' })
          } else {
            const read = tracks.length
            setState({ status: 'interrupted', kind, read, total, reason: 'cancelled', retryAfterMs: null })
          }
          return
        }

        const began = now()
        const page = readPage(await request(`/me/tracks?limit=${PAGE_SIZE}&offset=${offset}`))
        if (!page) throw new SpotifyRequestError('malformed', { status: 200 })
        for (const track of normalizeSavedTracks(page.items).tracks) {
          if (seen.has(trackKey(track))) continue
          seen.add(trackKey(track))
          tracks.push(track)
        }
        total = page.total
        offset += PAGE_SIZE
        pages += 1
        pageTimeMs += now() - began
        // Saved per page, so a failure or a closed tab resumes here instead of starting over.
        await store.savePartialScan({ tracks, nextOffset: offset, total, startedAt })
        // An empty page before the reported total means the library shrank mid-scan: there is nothing more to read.
        if (page.items.length === 0 || offset >= total) break
        setState({
          status: 'scanning',
          kind,
          read: tracks.length,
          total,
          estimateMs: remainingEstimateMs(offset, total, pageTimeMs / pages),
        })
      }

      const library: Library = { source: 'spotify', fetchedAt: new Date(now()).toISOString(), tracks }
      await store.saveLibrary(library)
      setState({ status: 'idle' })
      onLibrary(library)
    } catch (error) {
      const interruption = interruptionFor(error)
      setState(
        interruption
          ? { status: 'interrupted', kind, read: tracks.length, total, ...interruption }
          : { status: 'idle' },
      )
    }
  }

  async function exclusively(task: () => Promise<void>) {
    // Set before the first await, so a second click while the store is being read is ignored too.
    if (running) return
    running = true
    cancelRequested = false
    try {
      await task()
    } finally {
      running = false
    }
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    start: (kind) =>
      exclusively(async () => {
        await store.discardPartialScan()
        await run(kind, null)
      }),
    resume: (kind) => exclusively(async () => run(kind, await store.loadPartialScan())),
    cancel() {
      // A cancel while idle is harmless: the next scan resets it before its first request.
      cancelRequested = true
    },
    async restore(kind) {
      const partial = await store.loadPartialScan()
      if (!partial || running) return
      setState({
        status: 'interrupted',
        kind,
        read: partial.tracks.length,
        total: partial.total,
        reason: 'closed',
        retryAfterMs: null,
      })
    },
  }
}
