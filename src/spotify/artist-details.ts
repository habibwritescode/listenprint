import { isNonEmptyString, isRecord } from '../auth/guards.ts'
import { rankArtists } from '../library/rankings.ts'
import type { ArtistDetails, ArtistRanking, LibraryTrack } from '../library/types.ts'
import type { LibraryStore, SavedArtistDetails } from './library-store.ts'
import { pickImageUrl } from './images.ts'
import type { SpotifyRequest } from './request.ts'
import { SpotifyRequestError } from './request.ts'

/** Artist lookups are one request each since Spotify removed the batch endpoint, so only the top artists get one. */
export const TOP_ARTIST_COUNT = 50

export const DETAILS_MAX_AGE_MS = 30 * 86_400_000

/** Twice the 96px header tile, so photos stay sharp on 2x screens without downloading the 640px original. */
const MIN_PHOTO_WIDTH = 192

/**
 * The top catalog artists, in rank order, whose details are missing, failed last time, or older than 30 days.
 * Local-file artists have no Spotify page to look up.
 */
export function artistsNeedingDetails(
  rankings: readonly ArtistRanking[],
  saved: Readonly<Record<string, SavedArtistDetails>>,
  now: number,
): string[] {
  return rankings
    .map((ranking) => ranking.artist.id)
    .filter((id) => !id.startsWith('local:'))
    .slice(0, TOP_ARTIST_COUNT)
    .filter((id) => {
      const record = saved[id]
      return !record || record.details === null || now - record.fetchedAt > DETAILS_MAX_AGE_MS
    })
}

export function readArtistDetails(id: string, body: unknown): ArtistDetails | null {
  if (!isRecord(body)) return null
  const genres = Array.isArray(body.genres) ? body.genres.filter((genre) => isNonEmptyString(genre)) : []
  return { id, imageUrl: pickImageUrl(body.images, MIN_PHOTO_WIDTH), genres }
}

export interface ArtistDetailsDeps {
  request: SpotifyRequest
  store: LibraryStore
  now: () => number
  onSaved: (artistId: string, record: SavedArtistDetails) => void
}

/**
 * Looks up the top artists one at a time, saving each result as it arrives. A refused or unreadable lookup is saved
 * as failed and the pass moves on; rate limits, outages, lost access and ended sign-ins stop the pass, since every
 * later lookup would fail the same way. Whatever wasn't fetched is picked up by the next refresh.
 */
export async function fetchTopArtistDetails(deps: ArtistDetailsDeps, tracks: readonly LibraryTrack[]): Promise<void> {
  const { request, store, now, onSaved } = deps
  const ids = artistsNeedingDetails(rankArtists(tracks, 'all'), await store.loadArtistDetails(), now())

  for (const id of ids) {
    let details: ArtistDetails | null
    try {
      details = readArtistDetails(id, await request(`/artists/${encodeURIComponent(id)}`))
    } catch (error) {
      const refused = error instanceof SpotifyRequestError && ['rejected', 'malformed'].includes(error.reason)
      if (!refused) return
      details = null
    }
    const record = { details, fetchedAt: now() }
    await store.saveArtistDetails(id, record)
    onSaved(id, record)
  }
}
