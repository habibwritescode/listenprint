import type { RANKING_MODES } from './rankings.ts'

/** An artist credit on a track. */
export interface ArtistRef {
  /**
   * Grouping key. A Spotify artist ID (base62) for catalog artists. For local files, which have no
   * Spotify ID, producers must use `local:<artist name>`: local artists still merge by name but
   * never collide with a real Spotify ID.
   */
  id: string
  name: string
}

export interface LibraryTrack {
  /** Spotify track ID, or `local:<track uri>` for local files. */
  id: string
  name: string
  /** When the track was liked, as an ISO 8601 string (a string keeps Library JSON-serializable). */
  addedAt: string
  /** `null` when Spotify has none, and always in the demo, which generates no albums. */
  albumName: string | null
  albumImageUrl: string | null
  /** Credit order as Spotify returns it; index 0 is the primary artist. */
  artists: ArtistRef[]
}

/** Fetched separately, one request per artist, for the top artists only. */
export interface ArtistDetails {
  id: string
  imageUrl: string | null
  /** Deprecated by Spotify and often empty. */
  genres: string[]
}

export interface Library {
  source: 'spotify' | 'demo'
  /** ISO 8601 */
  fetchedAt: string
  /** Most recently liked first, the order Spotify returns. */
  tracks: LibraryTrack[]
}

/** `all` counts every credited artist; `primary` counts only artists[0]. Derived from RANKING_MODES. */
export type RankingMode = (typeof RANKING_MODES)[number]

export interface ArtistRanking {
  artist: ArtistRef
  /** Competition ranking: equal counts share a rank (1, 2, 2, 4). */
  rank: number
  count: number
  /** The counted tracks, in library order. Always `count === tracks.length`. */
  tracks: LibraryTrack[]
}
