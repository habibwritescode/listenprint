import type { ArtistRanking, ArtistRef, Library, LibraryTrack } from './types.ts'

export interface LibraryStats {
  trackCount: number
  artistCount: number
  leaderCount: number
}

const MIN_BAR_PERCENT = 4

export function libraryStats(rankings: readonly ArtistRanking[], tracks: readonly LibraryTrack[]): LibraryStats {
  return {
    trackCount: tracks.length,
    artistCount: rankings.length,
    leaderCount: rankings.at(0)?.count ?? 0,
  }
}

export function barWidthPercent(count: number, leaderCount: number): number {
  if (leaderCount <= 0) return 0
  return Math.min(100, Math.max(MIN_BAR_PERCENT, (count / leaderCount) * 100))
}

export function artistInitial(name: string): string {
  const letter = name.normalize('NFC').match(/\p{L}/u)?.[0]
  if (!letter) return '#'
  const upper = letter.toUpperCase()
  // Some letters uppercase to several characters (ß → SS); an avatar shows exactly one.
  return upper.length === 1 ? upper : letter
}

export function spotifyArtistUrl(artist: ArtistRef, source: Library['source']): string | null {
  if (source !== 'spotify' || artist.id.startsWith('local:')) return null
  return `https://open.spotify.com/artist/${encodeURIComponent(artist.id)}`
}
