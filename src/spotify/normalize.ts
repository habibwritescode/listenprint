import { isNonEmptyString, isRecord } from '../auth/guards.ts'
import type { ArtistRef, LibraryTrack } from '../library/types.ts'
import { pickImageUrl } from './images.ts'

/** Twice the 40px album tile, so covers stay sharp on 2x screens without downloading the full-size image. */
const MIN_ALBUM_IMAGE_WIDTH = 80

function artistRefs(value: unknown, local: boolean): ArtistRef[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const artists: ArtistRef[] = []
  for (const artist of value) {
    if (!isRecord(artist) || !isNonEmptyString(artist.name)) return null
    const id = !local && isNonEmptyString(artist.id) ? artist.id : `local:${artist.name}`
    artists.push({ id, name: artist.name })
  }
  return artists
}

function normalizeItem(item: unknown): LibraryTrack | null {
  if (!isRecord(item) || !isRecord(item.track)) return null
  const { added_at: addedAt } = item
  const track = item.track
  if (!isNonEmptyString(addedAt) || Number.isNaN(Date.parse(addedAt))) return null
  if (track.type !== 'track' || !isNonEmptyString(track.name)) return null

  const local = track.is_local === true
  // Local files have no Spotify id; the Library contract keys them on their URI instead.
  const key = local ? track.uri : track.id
  const id = isNonEmptyString(key) ? (local ? `local:${key}` : key) : null
  const artists = artistRefs(track.artists, local)
  if (id === null || artists === null) return null

  const album = isRecord(track.album) ? track.album : {}
  return {
    id,
    name: track.name,
    addedAt,
    albumName: isNonEmptyString(album.name) ? album.name : null,
    albumImageUrl: pickImageUrl(album.images, MIN_ALBUM_IMAGE_WIDTH),
    artists,
  }
}

/**
 * Spotify saved-track items as `LibraryTrack`s. Anything that can't be read (a removed track Spotify returns as null,
 * an episode, a missing name) is counted in `skipped` rather than thrown, so one bad item never fails a scan.
 */
export function normalizeSavedTracks(items: readonly unknown[]): { tracks: LibraryTrack[]; skipped: number } {
  const tracks: LibraryTrack[] = []
  for (const item of items) {
    const track = normalizeItem(item)
    if (track) tracks.push(track)
  }
  return { tracks, skipped: items.length - tracks.length }
}
