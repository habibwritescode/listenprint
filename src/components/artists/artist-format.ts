import { ordinal } from '../../library/presentation.ts'
import type { ArtistRanking, ArtistRef, Library } from '../../library/types.ts'

const countFormat = new Intl.NumberFormat()

interface KickerInput {
  /** `null` when the artist has no counted tracks in this mode: a featured-only artist in `primary`. */
  ranking: ArtistRanking | null
  tied: boolean
  artistCount: number
  /** Names the dataset, such as "Sample library", so the demo label survives on this page. */
  library?: string
}

export function artistKicker({ ranking, tied, artistCount, library }: KickerInput): string {
  if (!ranking) return 'Not ranked while counting primary artists only'
  const place = `${tied ? 'Tied' : 'Ranked'} ${ordinal(ranking.rank)} of ${countFormat.format(artistCount)}`
  return library ? `${library} · ${place}` : place
}

/** Only called when there's no Spotify link: the artist is either sample data or a local file. */
export function noSpotifyLinkNote(artist: ArtistRef, source: Library['source']): string {
  return source === 'demo' && !artist.id.startsWith('local:')
    ? 'Sample artist — no Spotify page'
    : 'No Spotify page — local files only'
}
