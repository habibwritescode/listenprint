import { countedArtists } from './rankings.ts'
import type { ArtistRef, LibraryTrack, RankingMode } from './types.ts'

export interface CoOccurrence {
  artist: ArtistRef
  /** Liked songs crediting both artists. */
  shared: number
  /** Those songs as a share of the other artist's own liked songs, however they are credited. */
  shareOfTheirs: number
}

const TABLE_ROWS = 5

/**
 * The artists who turn up most often on one artist's liked songs. The subject's own songs follow the ranking mode,
 * so "primary only" asks who features on their tracks; the other artist's total always counts every credit, because
 * "of theirs" is about their whole presence in the library.
 */
export function coOccurringArtists(
  tracks: readonly LibraryTrack[],
  artistId: string,
  mode: RankingMode,
  limit = TABLE_ROWS,
): CoOccurrence[] {
  const shared = new Map<string, { artist: ArtistRef; shared: number }>()
  const totals = new Map<string, number>()

  for (const track of tracks) {
    // Keyed by id, so a song crediting the same artist twice is still one song for both counts.
    const credits = new Map(track.artists.map((artist) => [artist.id, artist]))
    for (const id of credits.keys()) totals.set(id, (totals.get(id) ?? 0) + 1)

    if (!countedArtists(track, mode).some((artist) => artist.id === artistId)) continue
    for (const [id, artist] of credits) {
      if (id === artistId) continue
      const entry = shared.get(id) ?? { artist, shared: 0 }
      entry.shared += 1
      shared.set(id, entry)
    }
  }

  return [...shared.values()]
    .map((entry) => ({
      artist: entry.artist,
      shared: entry.shared,
      // Every artist here was credited on a counted song, so their own total was recorded on the same pass.
      shareOfTheirs: entry.shared / totals.get(entry.artist.id)!,
    }))
    .sort((a, b) => b.shared - a.shared || a.artist.name.localeCompare(b.artist.name))
    .slice(0, limit)
}
