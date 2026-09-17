import { countedArtists } from './rankings.ts'
import type { ArtistRef, LibraryTrack, RankingMode } from './types.ts'

/**
 * Genre tags per artist, holding only artists whose tags were looked up. An empty array means the lookup happened and
 * came back with none, which is what Spotify now returns for most artists; a missing id was never looked up at all.
 */
export type ArtistGenres = ReadonlyMap<string, readonly string[]>

export interface GenreShare {
  name: string
  /** Liked songs tagged with this genre. */
  tracks: number
  /** Share of tagged songs, never of the whole library. */
  share: number
  /** Counted artists carrying the genre. */
  artists: number
  /** The artist the genre comes from most. */
  topArtist: string
}

export interface GenreBreakdown {
  trackCount: number
  /** Songs with at least one tagged artist; the denominator for every share. */
  taggedTracks: number
  coverage: number
  genres: GenreShare[]
}

/** Below this, a chart would rank noise, so the view states the gap instead. */
export const MIN_GENRE_COVERAGE = 0.25

const TOP_GENRES = 8

interface GenreTally {
  tracks: number
  /** Songs each artist contributed, for the artist count and the leading artist. */
  byArtist: Map<string, { name: string; tracks: number }>
}

export function hasEnoughGenreCoverage(coverage: number): boolean {
  return coverage >= MIN_GENRE_COVERAGE
}

/**
 * The top genres across a library, attributed through the artists the ranking mode counts. A song counts once per
 * genre however many of its artists carry it, so shares compare songs rather than credits.
 */
export function genreBreakdown(
  tracks: readonly LibraryTrack[],
  genres: ArtistGenres,
  mode: RankingMode,
  limit = TOP_GENRES,
): GenreBreakdown {
  const tallies = new Map<string, GenreTally>()
  let taggedTracks = 0

  for (const track of tracks) {
    // Which artists carry each genre on this song, so the song counts once per genre but every artist gets credit.
    const carriers = new Map<string, ArtistRef[]>()
    const countedIds = new Set<string>()
    for (const artist of countedArtists(track, mode)) {
      if (countedIds.has(artist.id)) continue
      countedIds.add(artist.id)
      for (const genre of new Set(genres.get(artist.id) ?? [])) {
        carriers.set(genre, [...(carriers.get(genre) ?? []), artist])
      }
    }
    if (carriers.size > 0) taggedTracks += 1

    for (const [genre, artists] of carriers) {
      const tally = tallies.get(genre) ?? { tracks: 0, byArtist: new Map() }
      tally.tracks += 1
      for (const artist of artists) {
        const artistTally = tally.byArtist.get(artist.id) ?? { name: artist.name, tracks: 0 }
        artistTally.tracks += 1
        tally.byArtist.set(artist.id, artistTally)
      }
      tallies.set(genre, tally)
    }
  }

  const ranked = [...tallies]
    .map(([name, tally]) => ({
      name,
      tracks: tally.tracks,
      // A genre only exists here because a song carried it, so there is always at least one tagged song.
      share: tally.tracks / taggedTracks,
      artists: tally.byArtist.size,
      topArtist: [...tally.byArtist.values()].reduce((leader, artist) =>
        artist.tracks > leader.tracks ? artist : leader,
      ).name,
    }))
    .sort((a, b) => b.tracks - a.tracks || a.name.localeCompare(b.name))

  return {
    trackCount: tracks.length,
    taggedTracks,
    coverage: tracks.length === 0 ? 0 : taggedTracks / tracks.length,
    genres: ranked.slice(0, limit),
  }
}
