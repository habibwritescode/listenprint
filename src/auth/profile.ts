import { SPOTIFY_API_URL } from './config.ts'
import { isNonEmptyString, isRecord } from './guards.ts'

/**
 * `forbidden` (403) is how Spotify answers an account that isn't on a Development Mode app's allowlist.
 * `unavailable` (429 or 5xx) and `network` are transient.
 */
export type ProfileResult =
  | { ok: true; displayName: string | null }
  | { ok: false; reason: 'forbidden' | 'rejected' | 'unavailable' | 'network' | 'malformed' }

export async function fetchDisplayName(send: typeof fetch, accessToken: string): Promise<ProfileResult> {
  let response: Response
  try {
    response = await send(`${SPOTIFY_API_URL}/me`, { headers: { Authorization: `Bearer ${accessToken}` } })
  } catch {
    return { ok: false, reason: 'network' }
  }

  if (response.status === 403) return { ok: false, reason: 'forbidden' }
  if (response.status === 429 || response.status >= 500) return { ok: false, reason: 'unavailable' }
  if (!response.ok) return { ok: false, reason: 'rejected' }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  if (!isRecord(body)) return { ok: false, reason: 'malformed' }

  const { display_name: displayName } = body
  if (displayName === undefined || displayName === null || displayName === '') return { ok: true, displayName: null }
  return isNonEmptyString(displayName) ? { ok: true, displayName } : { ok: false, reason: 'malformed' }
}
