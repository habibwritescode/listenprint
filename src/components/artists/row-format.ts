import type { ArtistRanking } from '../../library/types.ts'

/** Rank, avatar, name, count, and at 741px and up the bar and share. Shared by rows, header and skeleton. */
export const ARTIST_ROW_GRID =
  'grid-cols-[30px_44px_minmax(0,1fr)_60px] min-[741px]:grid-cols-[46px_44px_minmax(0,1fr)_84px_130px]'

const shareFormat = new Intl.NumberFormat(undefined, {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

export function formatShare(share: number): string {
  return shareFormat.format(share)
}

/** The row's accessible name, as one string: separate screen-reader-only spans lose the spaces at their edges. */
export function artistRowLabel({ artist, rank, count }: ArtistRanking, share: number, tied: boolean): string {
  const songs = `${count} liked ${count === 1 ? 'song' : 'songs'}`
  return `Rank ${rank}, ${tied ? 'tied, ' : ''}${artist.name}, ${songs}, ${formatShare(share)} of library`
}
