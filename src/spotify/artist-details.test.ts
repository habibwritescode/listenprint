import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { SPOTIFY_API_URL } from '../auth/config.ts'
import { rankArtists } from '../library/rankings.ts'
import type { LibraryTrack } from '../library/types.ts'
import { createTestSession, signedInStorage } from '../test/auth-session.ts'
import { makeArtist, makeTrack } from '../test/factories.ts'
import { recordRequests, server, setupSpotifyMocks } from '../test/msw-server.ts'
import { ARTIST_URL, artistResponds } from '../test/spotify-library-handlers.ts'
import {
  DETAILS_MAX_AGE_MS,
  TOP_ARTIST_COUNT,
  artistsNeedingDetails,
  fetchTopArtistDetails,
  readArtistDetails,
} from './artist-details.ts'
import { createMemoryLibraryStore } from './library-store.ts'
import type { SavedArtistDetails } from './library-store.ts'
import { createSpotifyRequest } from './request.ts'

setupSpotifyMocks()

const NOW = Date.UTC(2026, 8, 17)
const DAY = 86_400_000

/** `count` artists, artist `i` credited on `count - i` tracks, so artist-0 ranks first. */
function tracksForArtists(count: number, { localAt = -1 } = {}): LibraryTrack[] {
  return Array.from({ length: count }, (_, i) => {
    const id = i === localAt ? `local:Garage ${i}` : `artist-${i}`
    const artist = makeArtist({ id, name: `Artist ${String(i).padStart(3, '0')}` })
    return Array.from({ length: count - i }, () => makeTrack({ artists: [artist] }))
  }).flat()
}

function saved(details: SavedArtistDetails['details'], ageDays: number): SavedArtistDetails {
  return { details, fetchedAt: NOW - ageDays * DAY }
}

describe('artistsNeedingDetails', () => {
  it('picks the top 50 catalog artists in rank order, skipping local files', () => {
    const rankings = rankArtists(tracksForArtists(60, { localAt: 3 }), 'all')

    const ids = artistsNeedingDetails(rankings, {}, NOW)

    expect(TOP_ARTIST_COUNT).toBe(50)
    expect(ids).toHaveLength(50)
    expect(ids.slice(0, 4)).toEqual(['artist-0', 'artist-1', 'artist-2', 'artist-4'])
    expect(ids).not.toContain('local:Garage 3')
    expect(ids.at(-1)).toBe('artist-50')
  })

  it('skips artists fetched within 30 days, and retries failed and older ones', () => {
    const rankings = rankArtists(tracksForArtists(4), 'all')
    const details = { id: 'x', imageUrl: null, genres: [] }

    const ids = artistsNeedingDetails(
      rankings,
      {
        'artist-0': saved(details, 29),
        'artist-1': saved(details, 31),
        'artist-2': saved(null, 1),
      },
      NOW,
    )

    expect(DETAILS_MAX_AGE_MS).toBe(30 * DAY)
    expect(ids).toEqual(['artist-1', 'artist-2', 'artist-3'])
  })
})

describe('readArtistDetails', () => {
  // The largest tile is 96px, so 192px keeps photos sharp on 2x screens without the 640px original.
  it('picks the smallest photo at least 192px wide, and keeps only text genres', () => {
    const body = {
      images: [
        { url: 'https://i.scdn.co/image/640', width: 640, height: 640 },
        { url: 'https://i.scdn.co/image/160', width: 160, height: 160 },
        { url: 'https://i.scdn.co/image/320', width: 320, height: 320 },
        { url: 'https://i.scdn.co/image/1000', width: 1000, height: 1000 },
      ],
      genres: ['dream pop', 7, 'shoegaze'],
    }

    expect(readArtistDetails('artist-0', body)).toEqual({
      id: 'artist-0',
      imageUrl: 'https://i.scdn.co/image/320',
      genres: ['dream pop', 'shoegaze'],
    })
  })

  it('falls back to the widest photo, then the first, then none', () => {
    const small = [
      { url: 'https://i.scdn.co/image/64', width: 64 },
      { url: 'https://i.scdn.co/image/160', width: 160 },
      { url: 'https://i.scdn.co/image/32', width: 32 },
    ]

    expect(readArtistDetails('a', { images: small })?.imageUrl).toBe('https://i.scdn.co/image/160')
    expect(readArtistDetails('a', { images: [{ url: 'https://i.scdn.co/image/x' }, null] })?.imageUrl).toBe(
      'https://i.scdn.co/image/x',
    )
    expect(readArtistDetails('a', { images: 'none', genres: 'none' })).toEqual({ id: 'a', imageUrl: null, genres: [] })
  })

  it('is null for a body that is not an artist', () => {
    expect(readArtistDetails('a', 'artist')).toBeNull()
  })
})

describe('fetchTopArtistDetails', () => {
  function setUp({ signedIn = true } = {}) {
    const { session } = signedIn ? createTestSession({ localStorage: signedInStorage() }) : createTestSession()
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined)
    const fetchWithMocks: typeof fetch = (input, init) => fetch(input, init)
    const request = createSpotifyRequest({ auth: session, fetch: fetchWithMocks, sleep, random: () => 0.5 })
    const store = createMemoryLibraryStore()
    const onSaved = vi.fn<(artistId: string, record: SavedArtistDetails) => void>()
    const run = (tracks: LibraryTrack[]) => fetchTopArtistDetails({ request, store, now: () => NOW, onSaved }, tracks)
    return { run, store, onSaved }
  }

  const photo = (id: string) => ({ images: [{ url: `https://i.scdn.co/image/${id}`, width: 320, height: 320 }] })

  function artistRequests(requests: { url: string }[]) {
    return requests
      .filter((request) => request.url.startsWith(`${SPOTIFY_API_URL}/artists/`))
      .map((request) => request.url.split('/').at(-1))
  }

  it('fetches each top artist one at a time and saves each as it arrives', async () => {
    server.use(
      artistResponds({
        'artist-0': { ...photo('a0'), genres: ['dream pop'] },
        'artist-1': photo('a1'),
        'artist-2': photo('a2'),
      }),
    )
    const requests = recordRequests()
    const { run, store, onSaved } = setUp()

    await run(tracksForArtists(3))

    expect(artistRequests(requests)).toEqual(['artist-0', 'artist-1', 'artist-2'])
    expect(await store.loadArtistDetails()).toEqual({
      'artist-0': {
        details: { id: 'artist-0', imageUrl: 'https://i.scdn.co/image/a0', genres: ['dream pop'] },
        fetchedAt: NOW,
      },
      'artist-1': { details: { id: 'artist-1', imageUrl: 'https://i.scdn.co/image/a1', genres: [] }, fetchedAt: NOW },
      'artist-2': { details: { id: 'artist-2', imageUrl: 'https://i.scdn.co/image/a2', genres: [] }, fetchedAt: NOW },
    })
    expect(onSaved.mock.calls.map(([id]) => id)).toEqual(['artist-0', 'artist-1', 'artist-2'])
  })

  it('records a lookup Spotify refuses or answers oddly as failed, and moves on', async () => {
    server.use(
      http.get(`${SPOTIFY_API_URL}/artists/artist-1`, () => HttpResponse.json('not an artist')),
      artistResponds({ 'artist-2': photo('a2') }),
    )
    const { run, store } = setUp()

    await run(tracksForArtists(3))

    const records = await store.loadArtistDetails()
    expect(records['artist-0']).toEqual({ details: null, fetchedAt: NOW })
    expect(records['artist-1']).toEqual({ details: null, fetchedAt: NOW })
    expect(records['artist-2'].details?.imageUrl).toBe('https://i.scdn.co/image/a2')
  })

  it.each([
    ['a long rate limit', () => HttpResponse.json({}, { status: 429, headers: { 'Retry-After': '600' } })],
    ['Spotify staying unavailable', () => new HttpResponse(null, { status: 503 })],
    ['access being refused', () => HttpResponse.json({}, { status: 403 })],
  ])('stops the whole pass on %s, saving nothing for that artist', async (_case, respond) => {
    server.use(http.get(`${SPOTIFY_API_URL}/artists/artist-1`, respond), artistResponds({ 'artist-0': photo('a0') }))
    const requests = recordRequests()
    const { run, store } = setUp()

    await run(tracksForArtists(3))

    expect(artistRequests(requests)).not.toContain('artist-2')
    expect(Object.keys(await store.loadArtistDetails())).toEqual(['artist-0'])
  })

  it('stops quietly when signed out', async () => {
    const requests = recordRequests()
    const { run, store } = setUp({ signedIn: false })

    await run(tracksForArtists(3))

    expect(requests).toHaveLength(0)
    expect(await store.loadArtistDetails()).toEqual({})
  })

  it('makes no requests when every top artist was fetched within 30 days', async () => {
    server.use(artistResponds({ 'artist-0': photo('a0'), 'artist-1': photo('a1') }))
    const { run } = setUp()
    await run(tracksForArtists(2))
    const requests = recordRequests()

    await run(tracksForArtists(2))

    expect(requests).toHaveLength(0)
  })

  it('encodes artist ids in the path', async () => {
    const requests = recordRequests()
    server.use(http.get(ARTIST_URL, () => HttpResponse.json({ images: [] })))
    const { run } = setUp()
    const artist = makeArtist({ id: 'odd/id', name: 'Odd' })

    await run([makeTrack({ artists: [artist] })])

    expect(requests[0].url).toBe(`${SPOTIFY_API_URL}/artists/odd%2Fid`)
  })
})
