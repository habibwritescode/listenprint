import type { ArtistGenres } from '../library/genres.ts'
import type { SavedArtistDetails } from './library-store.ts'

/**
 * Genre tags from the saved top-50 lookups. A failed lookup is left out: the artist pages tell "Spotify has no tags
 * for this artist" apart from "nobody has asked yet".
 */
export function savedArtistGenres(details: Readonly<Record<string, SavedArtistDetails>> | undefined): ArtistGenres {
  const genres = new Map<string, readonly string[]>()
  for (const [id, record] of Object.entries(details ?? {})) {
    if (record.details) genres.set(id, record.details.genres)
  }
  return genres
}
