import { isRecord } from '../auth/guards.ts'
import { AuthTokenError } from '../auth/session.ts'
import { SpotifyRequestError } from './request.ts'

/** `refresh` rescans while an earlier library is on screen; `initial` has nothing to fall back on. */
export type ScanKind = 'initial' | 'refresh'

/**
 * Why a scan stopped short. `network`: requests never arrived. `unavailable`: Spotify kept failing. `rateLimited`: a
 * wait longer than a minute. `quota`: the app's request quota is used up. `forbidden`: the account lost access.
 * `failed`: anything else. `cancelled`: the user stopped it. `closed`: an earlier visit ended mid-scan.
 */
export type ScanInterruption =
  | 'network'
  | 'unavailable'
  | 'rateLimited'
  | 'quota'
  | 'forbidden'
  | 'failed'
  | 'cancelled'
  | 'closed'

export type ScanState =
  | { status: 'idle' }
  | { status: 'scanning'; kind: ScanKind; read: number; total: number | null; estimateMs: number | null }
  | {
      status: 'interrupted'
      kind: ScanKind
      read: number
      total: number | null
      reason: ScanInterruption
      /** How long Spotify asked to wait, for `rateLimited` and `quota`. */
      retryAfterMs: number | null
    }

export const PAGE_SIZE = 50

/** A page of saved tracks, checked just enough to page through; each item is checked by `normalizeSavedTracks`. */
export function readPage(body: unknown): { items: unknown[]; total: number } | null {
  if (!isRecord(body) || !Array.isArray(body.items) || !Number.isInteger(body.total) || (body.total as number) < 0) {
    return null
  }
  return { items: body.items, total: body.total as number }
}

/** Remaining pages at the average time of the pages read so far. */
export function remainingEstimateMs(nextOffset: number, total: number, averagePageMs: number): number {
  return Math.ceil(Math.max(0, total - nextOffset) / PAGE_SIZE) * averagePageMs
}

/**
 * The interruption for a failed page, or `null` when sign-in itself ended: auth then shows its own notice and the
 * library is cleared, so there is nothing to resume.
 */
export function interruptionFor(error: unknown): { reason: ScanInterruption; retryAfterMs: number | null } | null {
  if (error instanceof AuthTokenError) {
    return error.reason === 'unavailable' ? { reason: 'network', retryAfterMs: null } : null
  }
  if (!(error instanceof SpotifyRequestError)) return { reason: 'failed', retryAfterMs: null }
  switch (error.reason) {
    case 'rateLimited':
      return { reason: error.quotaExceeded ? 'quota' : 'rateLimited', retryAfterMs: error.retryAfterMs }
    case 'unavailable':
      return { reason: error.status === null ? 'network' : 'unavailable', retryAfterMs: null }
    case 'forbidden':
      return { reason: 'forbidden', retryAfterMs: null }
    default:
      return { reason: 'failed', retryAfterMs: null }
  }
}
