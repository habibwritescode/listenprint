import { http, HttpResponse } from 'msw'
import type { JsonBodyType } from 'msw'
import { SPOTIFY_API_URL } from '../auth/config.ts'

export const SAVED_TRACKS_URL = `${SPOTIFY_API_URL}/me/tracks`
export const ARTIST_URL = `${SPOTIFY_API_URL}/artists/:id`

const HOUR = 3_600_000

/**
 * Raw saved-track items as Spotify returns them, newest like first. Track `n` is credited to
 * `artist-(n % artistCount)`, so ranks are predictable.
 */
export function savedTrackItems(count: number, { artistCount = 5, newest = Date.UTC(2026, 8, 1) } = {}) {
  return Array.from({ length: count }, (_, n) => {
    const artistIndex = n % artistCount
    return {
      added_at: new Date(newest - n * HOUR).toISOString().replace('.000Z', 'Z'),
      track: {
        type: 'track',
        id: `track${String(n).padStart(6, '0')}`,
        uri: `spotify:track:track${String(n).padStart(6, '0')}`,
        is_local: false,
        name: `Track ${n}`,
        artists: [{ id: `artist-${artistIndex}`, name: `Artist ${artistIndex}` }],
        album: {
          name: `Album ${n % 7}`,
          images: [{ url: `https://i.scdn.co/image/album-${n % 7}`, width: 300, height: 300 }],
        },
      },
    }
  })
}

/** Pages of `items` by `limit` and `offset`, shaped like Spotify's paging object. */
export function savedTracksResponds(items: readonly JsonBodyType[]) {
  return http.get(SAVED_TRACKS_URL, ({ request }) => {
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') ?? 20)
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const nextOffset = offset + limit
    return HttpResponse.json({
      href: request.url,
      limit,
      offset,
      total: items.length,
      items: items.slice(offset, nextOffset),
      next: nextOffset < items.length ? `${SAVED_TRACKS_URL}?offset=${nextOffset}&limit=${limit}` : null,
      previous: offset > 0 ? `${SAVED_TRACKS_URL}?offset=${Math.max(0, offset - limit)}&limit=${limit}` : null,
    })
  })
}

export function artistResponds(artists: Readonly<Record<string, { images?: unknown[]; genres?: string[] }>>) {
  return http.get(ARTIST_URL, ({ params }) => {
    const id = String(params.id)
    const artist = artists[id]
    if (!artist) return HttpResponse.json({ error: { status: 404, message: 'Resource not found' } }, { status: 404 })
    return HttpResponse.json({ type: 'artist', id, name: id, images: [], genres: [], ...artist })
  })
}

/** Answers the next request to `url` with `status`, once; later requests fall through to other handlers. */
interface MockResponse {
  headers?: Record<string, string>
  body?: JsonBodyType
}

export function respondOnceWith(url: string, status: number, { headers = {}, body }: MockResponse = {}) {
  const json = body ?? { error: { status, message: `Mock ${status}` } }
  return http.get(url, () => HttpResponse.json(json, { status, headers }), { once: true })
}

export function networkErrorOnce(url: string) {
  return http.get(url, () => HttpResponse.error(), { once: true })
}

/**
 * Fails the saved-tracks request at `offset` with `status` (or a network error), leaving other pages to later handlers.
 * `once` makes only the first attempt at that offset fail.
 */
export function failSavedTracksAt(
  offset: number,
  failure: number | 'network',
  { once = false, headers = {} }: { once?: boolean; headers?: Record<string, string> } = {},
) {
  // Counted here rather than with MSW's `once`, which would be used up by the first request at any offset.
  let failed = false
  return http.get(SAVED_TRACKS_URL, ({ request }) => {
    if (Number(new URL(request.url).searchParams.get('offset') ?? 0) !== offset || (once && failed)) return undefined
    failed = true
    if (failure === 'network') return HttpResponse.error()
    return HttpResponse.json({ error: { status: failure, message: `Mock ${failure}` } }, { status: failure, headers })
  })
}
