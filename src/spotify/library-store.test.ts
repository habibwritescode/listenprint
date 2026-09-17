import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import type { Library } from '../library/types.ts'
import { makeArtist, makeTrack } from '../test/factories.ts'
import { DATABASE_NAME, openIndexedDbStore, openLibraryStore } from './indexeddb-store.ts'
import { createMemoryLibraryStore } from './library-store.ts'
import type { LibraryStore, PartialScan } from './library-store.ts'

function library(trackCount = 3): Library {
  const artist = makeArtist({ id: 'artist-a', name: 'Artist A' })
  return {
    source: 'spotify',
    fetchedAt: '2026-09-17T10:00:00.000Z',
    tracks: Array.from({ length: trackCount }, () =>
      makeTrack({ artists: [artist], albumName: 'Album', albumImageUrl: 'https://i.scdn.co/image/a' }),
    ),
  }
}

function partialScan(): PartialScan {
  return { tracks: library(2).tracks, nextOffset: 50, total: 120, startedAt: '2026-09-17T09:59:00.000Z' }
}

const details = {
  details: { id: 'artist-a', imageUrl: 'https://i.scdn.co/image/p', genres: ['dream pop'] },
  fetchedAt: 1,
}

function describeLibraryStore(name: string, open: () => Promise<LibraryStore>) {
  describe(`${name} contract`, () => {
    it('starts empty', async () => {
      const store = await open()

      expect(await store.loadLibrary()).toBeNull()
      expect(await store.loadPartialScan()).toBeNull()
      expect(await store.loadArtistDetails()).toEqual({})
    })

    it('saves and loads a library, as a copy', async () => {
      const store = await open()
      const saved = library()
      const expected = structuredClone(saved)

      await store.saveLibrary(saved)
      saved.tracks.length = 0

      expect(await store.loadLibrary()).toEqual(expected)
    })

    it('saves and loads a partial scan, and discards it', async () => {
      const store = await open()
      const scan = partialScan()

      await store.savePartialScan(scan)
      expect(await store.loadPartialScan()).toEqual(scan)

      await store.discardPartialScan()
      expect(await store.loadPartialScan()).toBeNull()
    })

    // A finished scan replaces the library in one write, and its partial pages are no longer needed.
    it('discards the partial scan when a library is saved, but keeps artist details', async () => {
      const store = await open()
      await store.savePartialScan(partialScan())
      await store.saveArtistDetails('artist-a', details)

      await store.saveLibrary(library())

      expect(await store.loadPartialScan()).toBeNull()
      expect(await store.loadArtistDetails()).toEqual({ 'artist-a': details })
    })

    it('saves artist details one artist at a time, including failed lookups', async () => {
      const store = await open()

      await store.saveArtistDetails('artist-a', details)
      await store.saveArtistDetails('artist-b', { details: null, fetchedAt: 2 })
      await store.saveArtistDetails('artist-a', { ...details, fetchedAt: 3 })

      expect(await store.loadArtistDetails()).toEqual({
        'artist-a': { ...details, fetchedAt: 3 },
        'artist-b': { details: null, fetchedAt: 2 },
      })
    })

    it('clears everything', async () => {
      const store = await open()
      await store.saveLibrary(library())
      await store.savePartialScan(partialScan())
      await store.saveArtistDetails('artist-a', details)

      await store.clear()

      expect(await store.loadLibrary()).toBeNull()
      expect(await store.loadPartialScan()).toBeNull()
      expect(await store.loadArtistDetails()).toEqual({})
    })
  })
}

describeLibraryStore('memory store', async () => createMemoryLibraryStore())
describeLibraryStore('IndexedDB store', () => openIndexedDbStore(new IDBFactory()))

describe('IndexedDB store', () => {
  it('reports that it keeps the library, and the memory store that it does not', async () => {
    expect((await openIndexedDbStore(new IDBFactory())).persistent).toBe(true)
    expect(createMemoryLibraryStore().persistent).toBe(false)
  })

  it('keeps the library for the next visit', async () => {
    const indexedDB = new IDBFactory()
    const first = await openIndexedDbStore(indexedDB)
    await first.saveLibrary(library())
    await first.saveArtistDetails('artist-a', details)

    const second = await openIndexedDbStore(indexedDB)

    expect((await second.loadLibrary())?.tracks).toHaveLength(3)
    expect(await second.loadArtistDetails()).toEqual({ 'artist-a': details })
  })

  // A future version of the app in another tab must be able to upgrade the database, not wait on this tab forever.
  it('closes its connection when another tab upgrades the database', async () => {
    const indexedDB = new IDBFactory()
    await openIndexedDbStore(indexedDB)

    const upgraded = await new Promise<string>((resolve) => {
      const request = indexedDB.open(DATABASE_NAME, 2)
      request.onblocked = () => resolve('blocked')
      request.onsuccess = () => {
        request.result.close()
        resolve('upgraded')
      }
    })

    expect(upgraded).toBe('upgraded')
  })

  async function putRaw(indexedDB: IDBFactory, storeName: string, key: string, value: unknown) {
    await openIndexedDbStore(indexedDB)
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open(DATABASE_NAME)
      request.onsuccess = () => resolve(request.result)
    })
    await new Promise<void>((resolve) => {
      const transaction = db.transaction(storeName, 'readwrite')
      transaction.objectStore(storeName).put(value, key)
      transaction.oncomplete = () => resolve()
    })
    db.close()
  }

  const withTrack = (changes: Record<string, unknown>) => ({
    version: 1,
    library: { ...library(), tracks: [{ ...library().tracks[0], ...changes }] },
  })

  // Anything unreadable counts as no library, so a bad record means a rescan rather than a crash.
  it.each([
    ['an older format', { version: 0, library: library() }],
    ['a record that is not an object', 'library'],
    ['a library from the demo', { version: 1, library: { ...library(), source: 'demo' } }],
    ['a library without tracks', { version: 1, library: { ...library(), tracks: 'none' } }],
    ['a track without artists', withTrack({ artists: [] })],
    ['a track with a malformed artist', withTrack({ artists: [{ id: 1 }] })],
    ['a track with a numeric album', withTrack({ albumName: 7 })],
  ])('loads no library from %s', async (_case, record) => {
    const indexedDB = new IDBFactory()
    await putRaw(indexedDB, 'records', 'library', record)

    expect(await (await openIndexedDbStore(indexedDB)).loadLibrary()).toBeNull()
  })

  it.each([
    ['an older format', { version: 0, scan: partialScan() }],
    ['a negative offset', { version: 1, scan: { ...partialScan(), nextOffset: -1 } }],
    ['tracks that are not tracks', { version: 1, scan: { ...partialScan(), tracks: [null] } }],
  ])('loads no partial scan from %s', async (_case, record) => {
    const indexedDB = new IDBFactory()
    await putRaw(indexedDB, 'records', 'scan', record)

    expect(await (await openIndexedDbStore(indexedDB)).loadPartialScan()).toBeNull()
  })

  it('skips unreadable artist details', async () => {
    const indexedDB = new IDBFactory()
    await putRaw(indexedDB, 'artistDetails', 'artist-a', { version: 1, record: details })
    const partial = { details: { id: 'artist-b' }, fetchedAt: 1 }
    await putRaw(indexedDB, 'artistDetails', 'artist-b', { version: 1, record: partial })
    await putRaw(indexedDB, 'artistDetails', 'artist-c', { version: 1, record: { details: null } })
    await putRaw(indexedDB, 'artistDetails', 'artist-d', 'details')

    expect(await (await openIndexedDbStore(indexedDB)).loadArtistDetails()).toEqual({ 'artist-a': details })
  })
})

describe('openLibraryStore', () => {
  it('uses IndexedDB when it opens', async () => {
    const store = await openLibraryStore(() => new IDBFactory())

    expect(store.persistent).toBe(true)
  })

  it('falls back to memory when there is no IndexedDB', async () => {
    const store = await openLibraryStore(() => undefined)

    expect(store.persistent).toBe(false)
    await store.saveLibrary(library())
    expect(await store.loadLibrary()).not.toBeNull()
  })

  // Some browsers throw from open() or fail the request when site data is blocked.
  it.each([
    ['throws', () => ({ open: () => { throw new DOMException('blocked', 'SecurityError') } })],
    [
      'fails the request',
      () => ({
        open: () => {
          const request: { error: DOMException; onerror?: () => void } = {
            error: new DOMException('blocked', 'UnknownError'),
          }
          queueMicrotask(() => request.onerror?.())
          return request
        },
      }),
    ],
    [
      'is blocked by another tab',
      () => ({
        open: () => {
          const request = {} as { onblocked?: () => void }
          queueMicrotask(() => request.onblocked?.())
          return request
        },
      }),
    ],
  ])('falls back to memory when opening IndexedDB %s', async (_case, factory) => {
    const store = await openLibraryStore(() => factory() as unknown as IDBFactory)

    expect(store.persistent).toBe(false)
  })
})
