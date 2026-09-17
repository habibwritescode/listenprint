import { tiedRanks } from '../../library/presentation.ts'
import type { ArtistRanking } from '../../library/types.ts'

const scannedFormat = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'UTC',
})

/** When the saved library was read, in UTC like every other date in the app. */
export function scannedNote(fetchedAt: string): string {
  return `Scanned ${scannedFormat.format(new Date(fetchedAt))} UTC`
}

/** Ranks within the top 100 that more than one artist shares. */
export function tiesNote(rankings: readonly ArtistRanking[]): string {
  const ties = [...tiedRanks(rankings)].filter((rank) => rank <= 100).length
  if (ties === 0) return 'No ties in your top 100'
  return `${ties} ${ties === 1 ? 'tie' : 'ties'} in your top 100`
}
