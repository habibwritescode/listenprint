import type { ArtistRanking, ArtistRef, LibraryTrack, RankingMode } from './types.ts'

export const RANKING_MODES = ['all', 'primary'] as const

export const DEFAULT_RANKING_MODE: RankingMode = 'all'

export function isRankingMode(value: unknown): value is RankingMode {
  return (RANKING_MODES as readonly unknown[]).includes(value)
}

// Fixed locale so ordering is identical in every browser and in CI; 'base' ignores case and accents.
const nameCollator = new Intl.Collator('en', { sensitivity: 'base' })

function compareRankings(a: Omit<ArtistRanking, 'rank'>, b: Omit<ArtistRanking, 'rank'>): number {
  if (a.count !== b.count) return b.count - a.count
  const byName = nameCollator.compare(a.artist.name, b.artist.name)
  if (byName !== 0) return byName
  // Plain code-unit comparison: ids are opaque keys, not text for humans. They are also unique Map
  // keys, so two entries never share one and there is no equal case to return 0 for.
  return a.artist.id < b.artist.id ? -1 : 1
}

/** The credits a mode counts: every artist, or only the primary one. */
export function countedArtists(track: LibraryTrack, mode: RankingMode): readonly ArtistRef[] {
  return mode === 'all' ? track.artists : track.artists.slice(0, 1)
}

export function rankArtists(tracks: readonly LibraryTrack[], mode: RankingMode): ArtistRanking[] {
  const byArtistId = new Map<string, Omit<ArtistRanking, 'rank'>>()

  for (const track of tracks) {
    const countedOnTrack = new Set<string>()
    for (const artist of countedArtists(track, mode)) {
      if (countedOnTrack.has(artist.id)) continue
      countedOnTrack.add(artist.id)

      const entry = byArtistId.get(artist.id)
      if (entry) {
        entry.count += 1
        entry.tracks.push(track)
      } else {
        byArtistId.set(artist.id, { artist, count: 1, tracks: [track] })
      }
    }
  }

  const sorted = [...byArtistId.values()].sort(compareRankings)

  let rank = 0
  return sorted.map((entry, index) => {
    if (index === 0 || entry.count !== sorted[index - 1].count) rank = index + 1
    return { ...entry, rank }
  })
}

export function artistTracks(
  tracks: readonly LibraryTrack[],
  artistId: string,
  mode: RankingMode,
): LibraryTrack[] {
  return tracks.filter((track) => countedArtists(track, mode).some((artist) => artist.id === artistId))
}
