import { buildAuthorizeUrl, exchangeCode, refreshTokens } from './accounts.ts'
import type { TokenClient, TokenFailure } from './accounts.ts'
import { authReducer, initialAuthState } from './auth-machine.ts'
import type { AuthEvent, AuthState } from './auth-machine.ts'
import { codeChallengeS256, createCodeVerifier, createState } from './pkce.ts'
import type { RandomBytes } from './pkce.ts'
import { fetchDisplayName } from './profile.ts'
import type { ProfileResult } from './profile.ts'
import {
  TOKENS_KEY,
  clearPendingSignIn,
  clearTokens,
  readPendingSignIn,
  readTokens,
  writePendingSignIn,
  writeTokens,
} from './token-storage.ts'
import type { StorageLike, StoredTokens } from './token-storage.ts'

const FALLBACK_DISPLAY_NAME = 'Spotify user'

/** Refresh this close to expiry, so a token doesn't lapse between being handed out and being used. */
const REFRESH_MARGIN_MS = 60_000

export interface AuthSessionDeps {
  clientId: string
  redirectUri: string
  fetch: typeof fetch
  localStorage: StorageLike
  sessionStorage: StorageLike
  now: () => number
  randomBytes: RandomBytes
  /** Leaves the app for Spotify's authorize page. */
  redirect: (url: string) => void
  /** Registers for `localStorage` changes made by other tabs; the key is `null` when storage was cleared. */
  onStorageEvent: (listener: (key: string | null) => void) => void
}

/**
 * `signedOut`: no session. `expired`: Spotify rejected the refresh token, and the session has ended.
 * `unavailable`: the refresh failed for a transient reason; the session and tokens are kept.
 */
export type AuthTokenFailure = 'signedOut' | 'expired' | 'unavailable'

export class AuthTokenError extends Error {
  readonly reason: AuthTokenFailure

  constructor(reason: AuthTokenFailure) {
    super(reason)
    this.name = 'AuthTokenError'
    this.reason = reason
  }
}

/** The search params Spotify sends back to the redirect URI. */
export interface CallbackParams {
  code?: string
  state?: string
  error?: string
}

export interface AuthSession {
  getState(): AuthState
  subscribe(listener: () => void): () => void
  startSignIn(): Promise<void>
  completeSignIn(params: CallbackParams): Promise<void>
  signOut(): void
  /** A usable access token, refreshed first when it's within a minute of expiry. Rejects with `AuthTokenError`. */
  getAccessToken(): Promise<string>
  /** Refreshes regardless of expiry, after Spotify answered 401. Shares any refresh already in flight. */
  refreshAfterUnauthorized(): Promise<string>
}

type FailureReason = TokenFailure['reason'] | Extract<ProfileResult, { ok: false }>['reason']

function failureEvent(reason: FailureReason): AuthEvent {
  if (reason === 'forbidden') return { type: 'FORBIDDEN' }
  if (reason === 'network' || reason === 'unavailable') return { type: 'NETWORK_FAILED' }
  return { type: 'REJECTED', notice: 'unverified' }
}

export function createAuthSession(deps: AuthSessionDeps): AuthSession {
  const { clientId, redirectUri, localStorage, sessionStorage, now, randomBytes, redirect } = deps
  const tokenClient: TokenClient = { clientId, now, fetch: deps.fetch }

  let tokens: StoredTokens | null = readTokens(localStorage)
  let state = initialAuthState(tokens)
  const listeners = new Set<() => void>()
  // Keyed by the returned `state`: a code is single-use, and the callback route's loader may run twice.
  const completions = new Map<string, Promise<void>>()
  let refreshing: Promise<string> | null = null

  function dispatch(event: AuthEvent): boolean {
    const next = authReducer(state, event)
    if (next === state) return false
    state = next
    for (const listener of listeners) listener()
    return true
  }

  function storeTokens(next: StoredTokens) {
    tokens = next
    try {
      writeTokens(localStorage, next)
    } catch {
      // Storage refused (quota or blocked): this tab stays signed in, and a reload signs out.
    }
  }

  async function startSignIn() {
    if (authReducer(state, { type: 'START' }) === state) return
    const verifier = createCodeVerifier(randomBytes)
    const pendingState = createState(randomBytes)
    // Stored and dispatched before the first await, so a second click is ignored instead of replacing the attempt.
    writePendingSignIn(sessionStorage, { verifier, state: pendingState, createdAt: now() })
    dispatch({ type: 'START' })
    const codeChallenge = await codeChallengeS256(verifier)
    redirect(buildAuthorizeUrl({ clientId, redirectUri, state: pendingState, codeChallenge }))
  }

  async function complete({ code, state: returnedState, error }: CallbackParams) {
    // Read and deleted before anything else, so no outcome leaves the verifier behind.
    const pending = readPendingSignIn(sessionStorage)
    clearPendingSignIn(sessionStorage)
    if (!dispatch({ type: 'BEGIN_COMPLETION' })) return

    if (error !== undefined) {
      dispatch({ type: 'REJECTED', notice: error === 'access_denied' ? 'cancelled' : 'unverified' })
      return
    }
    if (!pending || !code || returnedState !== pending.state) {
      dispatch({ type: 'REJECTED', notice: 'unverified' })
      return
    }

    const exchanged = await exchangeCode(tokenClient, { code, redirectUri, codeVerifier: pending.verifier })
    if (!exchanged.ok) {
      dispatch(failureEvent(exchanged.reason))
      return
    }

    // Verified before storing: an account Spotify refuses (403) leaves nothing behind.
    const profile = await fetchDisplayName(deps.fetch, exchanged.tokens.accessToken)
    if (!profile.ok) {
      dispatch(failureEvent(profile.reason))
      return
    }

    const displayName = profile.displayName ?? FALLBACK_DISPLAY_NAME
    storeTokens({ ...exchanged.tokens, displayName })
    dispatch({ type: 'VERIFIED', displayName })
  }

  async function runRefresh(current: StoredTokens): Promise<string> {
    const result = await refreshTokens(tokenClient, current.refreshToken)

    // The session changed while waiting: signed out here, or another tab stored newer tokens. Either way
    // this response is stale and must not overwrite what's there.
    if (tokens !== current) {
      if (!tokens) throw new AuthTokenError('signedOut')
      return tokens.accessToken
    }

    if (!result.ok) {
      if (result.reason !== 'rejected') throw new AuthTokenError('unavailable')
      tokens = null
      clearTokens(localStorage)
      dispatch({ type: 'SESSION_EXPIRED' })
      throw new AuthTokenError('expired')
    }

    const { accessToken, refreshToken, expiresAt, scope } = result.tokens
    storeTokens({ ...current, accessToken, expiresAt, scope, refreshToken: refreshToken ?? current.refreshToken })
    return accessToken
  }

  function refresh(): Promise<string> {
    if (!tokens) return Promise.reject(new AuthTokenError('signedOut'))
    refreshing ??= runRefresh(tokens).finally(() => {
      refreshing = null
    })
    return refreshing
  }

  deps.onStorageEvent((key) => {
    if (key !== null && key !== TOKENS_KEY) return
    if (state.status !== 'signedIn') return
    tokens = readTokens(localStorage)
    if (!tokens) dispatch({ type: 'SIGN_OUT' })
  })

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    startSignIn,
    completeSignIn(params) {
      const key = params.state ?? ''
      let completion = completions.get(key)
      if (!completion) {
        completion = complete(params)
        completions.set(key, completion)
      }
      return completion
    },
    signOut() {
      tokens = null
      clearTokens(localStorage)
      clearPendingSignIn(sessionStorage)
      dispatch({ type: 'SIGN_OUT' })
    },
    async getAccessToken() {
      if (tokens && tokens.expiresAt - now() > REFRESH_MARGIN_MS) return tokens.accessToken
      return refresh()
    },
    refreshAfterUnauthorized: refresh,
  }
}
