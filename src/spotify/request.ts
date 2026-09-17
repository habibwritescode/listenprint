import { SPOTIFY_API_URL } from '../auth/config.ts'
import { isRecord } from '../auth/guards.ts'
import type { AuthSession } from '../auth/session.ts'
import { MAX_RETRIES, MAX_RETRY_AFTER_MS, backoffDelay, parseRetryAfter } from './retry.ts'

/**
 * `expired`: still 401 after one refresh. `rateLimited`: a 429 whose wait is too long, or a used-up quota.
 * `unavailable`: 5xx or network errors that outlasted the retries. `forbidden`: 403, such as an account removed from
 * the app's allowlist. `rejected`: any other refusal. `malformed`: a success that isn't JSON.
 */
export type SpotifyFailure = 'expired' | 'rateLimited' | 'unavailable' | 'forbidden' | 'rejected' | 'malformed'

interface FailureDetails {
  status: number | null
  retryAfterMs?: number | null
  quotaExceeded?: boolean
}

export class SpotifyRequestError extends Error {
  readonly reason: SpotifyFailure
  /** `null` when no response arrived. */
  readonly status: number | null
  /** How long Spotify asked to wait, when it said. */
  readonly retryAfterMs: number | null
  readonly quotaExceeded: boolean

  constructor(reason: SpotifyFailure, { status, retryAfterMs = null, quotaExceeded = false }: FailureDetails) {
    // The message carries only the reason and status: never a URL with a token, or a token itself.
    super(status === null ? reason : `${reason} (${status})`)
    this.name = 'SpotifyRequestError'
    this.reason = reason
    this.status = status
    this.retryAfterMs = retryAfterMs
    this.quotaExceeded = quotaExceeded
  }
}

export interface SpotifyRequestDeps {
  auth: Pick<AuthSession, 'getAccessToken' | 'refreshAfterUnauthorized'>
  fetch: typeof fetch
  sleep: (ms: number) => Promise<void>
  random: () => number
}

/** GETs a path under the Web API root, such as `/me/tracks?limit=50&offset=0`, and resolves with its JSON body. */
export type SpotifyRequest = (path: string) => Promise<unknown>

async function isQuotaExceeded(response: Response): Promise<boolean> {
  try {
    const body: unknown = await response.json()
    if (!isRecord(body)) return false
    const nested = isRecord(body.error) ? body.error.reason : undefined
    return body.reason === 'QUOTA_EXCEEDED' || nested === 'QUOTA_EXCEEDED'
  } catch {
    return false
  }
}

export function createSpotifyRequest({ auth, fetch, sleep, random }: SpotifyRequestDeps): SpotifyRequest {
  return async (path) => {
    let refreshed = false
    let retries = 0

    const retryOrFail = async (failure: SpotifyRequestError, delayMs = backoffDelay(retries, random)) => {
      if (retries >= MAX_RETRIES) throw failure
      retries += 1
      await sleep(delayMs)
    }

    for (;;) {
      // Asked for on every attempt: a refresh elsewhere, or after a 401 here, replaces the token.
      const token = await auth.getAccessToken()
      let response: Response
      try {
        response = await fetch(`${SPOTIFY_API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } })
      } catch {
        await retryOrFail(new SpotifyRequestError('unavailable', { status: null }))
        continue
      }

      const { status } = response
      if (response.ok) {
        try {
          return (await response.json()) as unknown
        } catch {
          throw new SpotifyRequestError('malformed', { status })
        }
      }
      if (status === 401) {
        // At most one refresh per request: the old app refreshed and retried on every 401, forever.
        if (refreshed) throw new SpotifyRequestError('expired', { status })
        refreshed = true
        await auth.refreshAfterUnauthorized()
        continue
      }
      if (status === 429) {
        const retryAfterMs = parseRetryAfter(response.headers.get('Retry-After'))
        const quotaExceeded = await isQuotaExceeded(response)
        const limited = new SpotifyRequestError('rateLimited', { status, retryAfterMs, quotaExceeded })
        if (quotaExceeded || (retryAfterMs !== null && retryAfterMs > MAX_RETRY_AFTER_MS)) throw limited
        await retryOrFail(limited, retryAfterMs ?? undefined)
        continue
      }
      if (status >= 500) {
        await retryOrFail(new SpotifyRequestError('unavailable', { status }))
        continue
      }
      throw new SpotifyRequestError(status === 403 ? 'forbidden' : 'rejected', { status })
    }
  }
}
