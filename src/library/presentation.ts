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

export function spotifyTrackUrl(track: LibraryTrack, source: Library['source']): string | null {
  if (source !== 'spotify' || track.id.startsWith('local:')) return null
  return `https://open.spotify.com/track/${encodeURIComponent(track.id)}`
}

/** Artists and distinct liked tracks at ranks 1–10, ranks 11–100, and below rank 100. */
export interface Concentration {
  top10Artists: number
  top10Tracks: number
  next90Artists: number
  next90Tracks: number
  restArtists: number
  restTracks: number
}

function distinctTrackCount(rankings: readonly ArtistRanking[]): number {
  return new Set(rankings.flatMap((ranking) => ranking.tracks.map((track) => track.id))).size
}

/**
 * Tiers follow ranks, so tied artists are never split between tiers and the top 10 can hold more than ten artists.
 * A track is counted once per tier even when several of its artists are in it, so the parts never add up to more
 * than the library.
 */
export function concentration(rankings: readonly ArtistRanking[], trackCount: number): Concentration | null {
  if (trackCount === 0) return null
  const top10 = rankings.filter((ranking) => ranking.rank <= 10)
  const top100 = rankings.filter((ranking) => ranking.rank <= 100)
  const top10Tracks = distinctTrackCount(top10)
  const top100Tracks = distinctTrackCount(top100)
  return {
    top10Artists: top10.length,
    top10Tracks,
    next90Artists: top100.length - top10.length,
    next90Tracks: top100Tracks - top10Tracks,
    restArtists: rankings.length - top100.length,
    restTracks: trackCount - top100Tracks,
  }
}

/** Whole percentages that add up to exactly 100 (largest remainder), so a stacked bar's legend never reads 99%. */
export function roundedPercents(parts: readonly number[]): number[] {
  const total = parts.reduce((sum, part) => sum + part, 0)
  if (total === 0) return parts.map(() => 0)
  const exact = parts.map((part) => (part / total) * 100)
  const rounded = exact.map(Math.floor)
  const shortfall = 100 - rounded.reduce((sum, part) => sum + part, 0)
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - rounded[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  for (const { index } of byRemainder.slice(0, shortfall)) rounded[index] += 1
  return rounded
}

export function shareOfLibrary(count: number, trackCount: number): number {
  return trackCount === 0 ? 0 : count / trackCount
}

export function tiedRanks(rankings: readonly ArtistRanking[]): Set<number> {
  const seen = new Set<number>()
  const tied = new Set<number>()
  for (const { rank } of rankings) {
    if (seen.has(rank)) tied.add(rank)
    seen.add(rank)
  }
  return tied
}

export function primaryCount(artistId: string, tracks: readonly LibraryTrack[]): number {
  return tracks.filter((track) => track.artists[0]?.id === artistId).length
}

/** The month of the earliest like as `YYYY-MM`, in UTC like every other date in the app. */
export function firstLiked(tracks: readonly LibraryTrack[]): string | null {
  if (tracks.length === 0) return null
  const earliest = Math.min(...tracks.map((track) => Date.parse(track.addedAt)))
  return new Date(earliest).toISOString().slice(0, 7)
}

// English only, like the rest of the copy, so the digits use the English grouping that matches the suffix.
const englishOrdinals = new Intl.PluralRules('en', { type: 'ordinal' })
const englishCount = new Intl.NumberFormat('en')
const ORDINAL_SUFFIXES: Record<Intl.LDMLPluralRule, string> = {
  zero: 'th',
  one: 'st',
  two: 'nd',
  few: 'rd',
  many: 'th',
  other: 'th',
}

export function ordinal(n: number): string {
  return `${englishCount.format(n)}${ORDINAL_SUFFIXES[englishOrdinals.select(n)]}`
}

export type AvatarTone = 1 | 2 | 3 | 4

/** The design's hash, so an artist gets the same tint here as in the mockups. */
export function avatarTone(name: string): AvatarTone {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) | 0
  return ((Math.abs(hash) % 4) + 1) as AvatarTone
}

export const SORT_ORDERS = ['count', 'alpha'] as const

export type SortOrder = (typeof SORT_ORDERS)[number]

export const DEFAULT_SORT_ORDER: SortOrder = 'count'

export function isSortOrder(value: unknown): value is SortOrder {
  return (SORT_ORDERS as readonly unknown[]).includes(value)
}

// Fixed locale so the order is the same in every browser and in CI; numeric so "Alpha 9" comes before "Alpha 10".
const alphaCollator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

/** Reorders rows without touching their ranks: in `alpha` a rank still means the artist's place by count. */
export function sortRankings(rankings: readonly ArtistRanking[], order: SortOrder): readonly ArtistRanking[] {
  if (order === 'count') return rankings
  return [...rankings].sort(
    (a, b) =>
      alphaCollator.compare(a.artist.name, b.artist.name) ||
      a.rank - b.rank ||
      (a.artist.id < b.artist.id ? -1 : 1),
  )
}
