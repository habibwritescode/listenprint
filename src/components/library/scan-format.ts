import type { ScanInterruption } from '../../spotify/scan-machine.ts'

const countFormat = new Intl.NumberFormat()

/** Progress in tracks, which people recognise, rather than pages. */
export function scanProgressText(read: number, total: number | null): string {
  if (total === null) return 'Reading your liked songs…'
  return `Read ${countFormat.format(read)} of ${countFormat.format(total)} liked songs…`
}

function minutes(ms: number): string {
  const count = Math.max(1, Math.ceil(ms / 60_000))
  return `${count} ${count === 1 ? 'minute' : 'minutes'}`
}

export function timeLeftText(ms: number | null): string | null {
  if (ms === null || ms <= 0) return null
  if (ms < 10_000) return 'a few seconds left'
  if (ms < 55_000) return `about ${Math.ceil(ms / 5_000) * 5} seconds left`
  return `about ${minutes(ms)} left`
}

interface Interrupted {
  read: number
  total: number | null
  reason: ScanInterruption
  retryAfterMs: number | null
}

export function interruptionMessage({ read, total, reason, retryAfterMs }: Interrupted): string {
  const progress =
    total === null ? 'any liked songs' : `${countFormat.format(read)} of ${countFormat.format(total)} liked songs`
  const at = total === null ? `before reading ${progress}` : `at ${progress}`

  switch (reason) {
    case 'network':
      return `Your connection dropped, so the scan stopped ${at}.`
    case 'unavailable':
      return `Spotify stopped responding, so the scan paused ${at}.`
    case 'forbidden':
      return `Spotify refused access to your library ${at}. If your invite was removed, the demo still works.`
    case 'failed':
      return `Something went wrong reading your library, ${at}.`
    case 'cancelled':
      return `You stopped the scan ${at}.`
    case 'closed':
      return `An earlier scan stopped ${at} when its tab closed.`
    case 'rateLimited':
      return retryAfterMs === null
        ? `Spotify asked Listenprint to slow down ${at}.`
        : `Spotify asked Listenprint to wait ${minutes(retryAfterMs)} ${at}.`
    case 'quota':
      return `Listenprint has used up its Spotify requests for now, ${at}. ${
        retryAfterMs === null ? 'Try again later.' : `Try again in ${minutes(retryAfterMs)}.`
      }`
  }
}
