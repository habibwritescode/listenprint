export const MAX_RETRIES = 4

/** Longer waits interrupt the scan with the wait shown, instead of leaving a request silently pending. */
export const MAX_RETRY_AFTER_MS = 60_000

const BASE_DELAY_MS = 1_000
const MAX_DELAY_MS = 16_000

/**
 * Exponential backoff with full jitter: a random delay between zero and a ceiling that doubles per retry. Clients that
 * failed together don't all come back at the same moment.
 */
export function backoffDelay(retry: number, random: () => number): number {
  return random() * Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** retry)
}

/** Spotify sends whole seconds. Anything else, including an HTTP date, counts as unknown. */
export function parseRetryAfter(header: string | null): number | null {
  const value = header?.trim()
  return value && /^\d+$/.test(value) ? Number(value) * 1_000 : null
}
