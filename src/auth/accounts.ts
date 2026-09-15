import { SPOTIFY_AUTHORIZE_URL, SPOTIFY_SCOPES, SPOTIFY_TOKEN_URL } from './config.ts'
import { isFiniteNumber, isNonEmptyString, isRecord } from './guards.ts'

interface AuthorizeParams {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
}

export function buildAuthorizeUrl({ clientId, redirectUri, state, codeChallenge }: AuthorizeParams): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SPOTIFY_SCOPES.join(' '),
    redirect_uri: redirectUri,
    state,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  })
  return `${SPOTIFY_AUTHORIZE_URL}?${params}`
}

export interface TokenSet {
  accessToken: string
  /** `null` when a refresh response didn't include one: keep using the previous refresh token. */
  refreshToken: string | null
  /** Epoch milliseconds. */
  expiresAt: number
  scope: string
}

/** Tokens from a code exchange, which always carries a refresh token. */
export interface IssuedTokens extends TokenSet {
  refreshToken: string
}

/**
 * `rejected`: Spotify refused the grant (4xx), e.g. `invalid_grant` for a spent code or an expired refresh
 * token. `unavailable` (5xx) and `network` are transient, so they must never end a session.
 */
export type TokenFailure =
  | { ok: false; reason: 'rejected'; error: string }
  | { ok: false; reason: 'unavailable'; status: number }
  | { ok: false; reason: 'malformed' }
  | { ok: false; reason: 'network' }

export type TokenResult<T extends TokenSet = TokenSet> = { ok: true; tokens: T } | TokenFailure

export interface TokenClient {
  clientId: string
  now: () => number
  fetch: typeof fetch
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

function parseTokenSet(body: unknown, now: number): TokenSet | null {
  if (!isRecord(body)) return null
  const { access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn, scope } = body
  if (!isNonEmptyString(accessToken) || !isFiniteNumber(expiresIn) || expiresIn <= 0) return null
  if (refreshToken !== undefined && !isNonEmptyString(refreshToken)) return null

  return {
    accessToken,
    refreshToken: isNonEmptyString(refreshToken) ? refreshToken : null,
    expiresAt: now + expiresIn * 1000,
    scope: typeof scope === 'string' ? scope : '',
  }
}

async function requestTokens(client: TokenClient, params: Record<string, string>): Promise<TokenResult> {
  // Destructured so fetch isn't called as a method of `client`: browsers reject that as an illegal invocation.
  const { fetch: send, clientId, now } = client
  let response: Response
  try {
    response = await send(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...params, client_id: clientId }),
    })
  } catch {
    return { ok: false, reason: 'network' }
  }

  if (response.status >= 500) return { ok: false, reason: 'unavailable', status: response.status }

  const body = await readJson(response)
  if (!response.ok) {
    const error = isRecord(body) && isNonEmptyString(body.error) ? body.error : `http_${response.status}`
    return { ok: false, reason: 'rejected', error }
  }

  const tokens = parseTokenSet(body, now())
  return tokens ? { ok: true, tokens } : { ok: false, reason: 'malformed' }
}

export async function exchangeCode(
  client: TokenClient,
  { code, redirectUri, codeVerifier }: { code: string; redirectUri: string; codeVerifier: string },
): Promise<TokenResult<IssuedTokens>> {
  const result = await requestTokens(client, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  })
  if (!result.ok) return result
  const { refreshToken } = result.tokens
  // Without a refresh token the session couldn't outlive the first hour.
  return refreshToken === null ? { ok: false, reason: 'malformed' } : { ok: true, tokens: { ...result.tokens, refreshToken } }
}

export function refreshTokens(client: TokenClient, refreshToken: string): Promise<TokenResult> {
  return requestTokens(client, { grant_type: 'refresh_token', refresh_token: refreshToken })
}
