import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { NOW, createTestSession, requestsTo, signedInStorage, storedTokens } from '../test/auth-session.ts'
import { createMemoryStorage } from '../test/memory-storage.ts'
import { recordRequests, server, setupSpotifyMocks } from '../test/msw-server.ts'
import { TEST_TOKENS, spotifyNetworkError, tokenRejects, tokenResponds } from '../test/spotify-handlers.ts'
import { SPOTIFY_TOKEN_URL } from './config.ts'
import { AuthTokenError } from './session.ts'
import { TOKENS_KEY, readTokens, writeTokens } from './token-storage.ts'

setupSpotifyMocks()

/** Holds the token endpoint's response until `release` is called, to act while a refresh is in flight. */
function holdTokenResponse() {
  let release = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  server.use(
    http.post(SPOTIFY_TOKEN_URL, async () => {
      await released
      return HttpResponse.json({ access_token: 'late-access-token', expires_in: 3600, scope: 'user-library-read' })
    }),
  )
  return { release }
}

describe('a session starting from stored tokens', () => {
  it('starts signed in with the stored display name, without contacting Spotify', () => {
    const requests = recordRequests()

    const { session } = createTestSession({ localStorage: signedInStorage() })

    expect(session.getState()).toEqual({ status: 'signedIn', displayName: 'Stored Listener' })
    expect(requests).toHaveLength(0)
  })

  it('starts signed out without stored tokens', () => {
    expect(createTestSession().session.getState()).toEqual({ status: 'signedOut' })
  })
})

describe('getAccessToken', () => {
  it('returns the stored access token while more than a minute remains', async () => {
    const { session } = createTestSession({ localStorage: signedInStorage({ expiresAt: NOW + 60_001 }) })
    const requests = recordRequests()

    expect(await session.getAccessToken()).toBe('stored-access-token')
    expect(requests).toHaveLength(0)
  })

  it('refreshes within a minute of expiry, keeping the refresh token when Spotify sends none', async () => {
    const localStorage = signedInStorage({ expiresAt: NOW + 60_000 })
    const { session } = createTestSession({ localStorage })
    const requests = recordRequests()

    expect(await session.getAccessToken()).toBe(TEST_TOKENS.refreshedAccessToken)

    const tokenRequests = requestsTo(requests, SPOTIFY_TOKEN_URL)
    expect(tokenRequests).toHaveLength(1)
    expect(new URLSearchParams(await tokenRequests[0].body).get('refresh_token')).toBe('stored-refresh-token')
    expect(readTokens(localStorage)).toEqual(
      storedTokens({ accessToken: TEST_TOKENS.refreshedAccessToken, expiresAt: NOW + 3_600_000 }),
    )
    expect(await session.getAccessToken()).toBe(TEST_TOKENS.refreshedAccessToken)
    expect(requestsTo(requests, SPOTIFY_TOKEN_URL)).toHaveLength(1)
  })

  it('stores a rotated refresh token', async () => {
    server.use(tokenResponds({ access_token: 'new-access', refresh_token: 'rotated', expires_in: 3600, scope: 's' }))
    const localStorage = signedInStorage({ expiresAt: NOW })
    const { session } = createTestSession({ localStorage })

    await session.getAccessToken()

    expect(readTokens(localStorage)).toMatchObject({ accessToken: 'new-access', refreshToken: 'rotated', scope: 's' })
  })

  // Parallel API calls at expiry would otherwise each spend the refresh token.
  it('shares one refresh between concurrent callers', async () => {
    const { session } = createTestSession({ localStorage: signedInStorage({ expiresAt: NOW }) })
    const requests = recordRequests()

    const tokens = await Promise.all([
      session.getAccessToken(),
      session.getAccessToken(),
      session.refreshAfterUnauthorized(),
    ])

    expect(tokens).toEqual([
      TEST_TOKENS.refreshedAccessToken,
      TEST_TOKENS.refreshedAccessToken,
      TEST_TOKENS.refreshedAccessToken,
    ])
    expect(requestsTo(requests, SPOTIFY_TOKEN_URL)).toHaveLength(1)
  })

  it('rejects when signed out, without contacting Spotify', async () => {
    const { session } = createTestSession()
    const requests = recordRequests()

    await expect(session.getAccessToken()).rejects.toMatchObject({ name: 'AuthTokenError', reason: 'signedOut' })
    expect(requests).toHaveLength(0)
  })
})

describe('refreshAfterUnauthorized', () => {
  it('refreshes even when the access token has not reached its expiry', async () => {
    const { session } = createTestSession({ localStorage: signedInStorage() })
    const requests = recordRequests()

    expect(await session.refreshAfterUnauthorized()).toBe(TEST_TOKENS.refreshedAccessToken)
    expect(requestsTo(requests, SPOTIFY_TOKEN_URL)).toHaveLength(1)
  })

  it('rejects when signed out', async () => {
    const { session } = createTestSession()

    await expect(session.refreshAfterUnauthorized()).rejects.toBeInstanceOf(AuthTokenError)
  })
})

describe('refresh failures', () => {
  it.each([
    ['an expired refresh token (invalid_grant)', tokenRejects('invalid_grant')],
    ['any other client error', tokenResponds({ error: 'invalid_client' }, 401)],
  ])('ends the session on %s', async (_case, handler) => {
    server.use(handler)
    const localStorage = signedInStorage({ expiresAt: NOW })
    const { session } = createTestSession({ localStorage })
    const listener = vi.fn()
    session.subscribe(listener)

    await expect(session.getAccessToken()).rejects.toMatchObject({ reason: 'expired' })

    expect(session.getState()).toEqual({ status: 'signedOut', notice: 'expired' })
    expect(localStorage.entries()).toEqual({})
    expect(listener).toHaveBeenCalledTimes(1)
    await expect(session.getAccessToken()).rejects.toMatchObject({ reason: 'signedOut' })
  })

  it.each([
    ['a failed connection', spotifyNetworkError(SPOTIFY_TOKEN_URL)],
    ['Spotify being unavailable', tokenResponds({ error: 'server_error' }, 503)],
    ['a malformed response', tokenResponds({ expires_in: 3600 })],
  ])('keeps the session and tokens on %s, and tries again on the next call', async (_case, handler) => {
    server.use(handler)
    const localStorage = signedInStorage({ expiresAt: NOW })
    const before = localStorage.entries()
    const { session } = createTestSession({ localStorage })
    const requests = recordRequests()

    await expect(session.getAccessToken()).rejects.toMatchObject({ reason: 'unavailable' })

    expect(session.getState()).toEqual({ status: 'signedIn', displayName: 'Stored Listener' })
    expect(localStorage.entries()).toEqual(before)

    server.resetHandlers()
    expect(await session.getAccessToken()).toBe(TEST_TOKENS.refreshedAccessToken)
    expect(requestsTo(requests, SPOTIFY_TOKEN_URL)).toHaveLength(2)
  })

  it('does not bring back tokens when signing out while a refresh is in flight', async () => {
    const { release } = holdTokenResponse()
    const localStorage = signedInStorage({ expiresAt: NOW })
    const { session } = createTestSession({ localStorage })
    const requests = recordRequests()

    const pending = session.getAccessToken()
    await vi.waitFor(() => expect(requests).toHaveLength(1))
    session.signOut()
    release()

    await expect(pending).rejects.toMatchObject({ reason: 'signedOut' })
    expect(localStorage.entries()).toEqual({})
    expect(session.getState()).toEqual({ status: 'signedOut' })
  })

  it("keeps another tab's newer tokens when they arrive during this tab's refresh", async () => {
    const { release } = holdTokenResponse()
    const localStorage = signedInStorage({ expiresAt: NOW })
    const { session, emitStorageEvent } = createTestSession({ localStorage })
    const requests = recordRequests()

    const pending = session.getAccessToken()
    await vi.waitFor(() => expect(requests).toHaveLength(1))
    writeTokens(localStorage, storedTokens({ accessToken: 'other-tab-access-token', refreshToken: 'other-tab-refresh' }))
    emitStorageEvent(TOKENS_KEY)
    release()

    expect(await pending).toBe('other-tab-access-token')
    expect(readTokens(localStorage)).toMatchObject({ accessToken: 'other-tab-access-token' })
  })
})

describe('other tabs', () => {
  it('signs out when another tab removes the tokens', async () => {
    const localStorage = signedInStorage()
    const { session, emitStorageEvent } = createTestSession({ localStorage })
    const listener = vi.fn()
    session.subscribe(listener)

    localStorage.removeItem(TOKENS_KEY)
    emitStorageEvent(TOKENS_KEY)

    expect(session.getState()).toEqual({ status: 'signedOut' })
    expect(listener).toHaveBeenCalledTimes(1)
    await expect(session.getAccessToken()).rejects.toMatchObject({ reason: 'signedOut' })
  })

  it('signs out when another tab clears all storage', () => {
    const localStorage = signedInStorage()
    const { session, emitStorageEvent } = createTestSession({ localStorage })

    localStorage.removeItem(TOKENS_KEY)
    emitStorageEvent(null)

    expect(session.getState()).toEqual({ status: 'signedOut' })
  })

  it('ignores changes to other keys', () => {
    const localStorage = signedInStorage()
    const { session, emitStorageEvent } = createTestSession({ localStorage })

    localStorage.removeItem(TOKENS_KEY)
    emitStorageEvent('some-other-key')

    expect(session.getState()).toEqual({ status: 'signedIn', displayName: 'Stored Listener' })
  })

  it('uses tokens another tab refreshed, without refreshing again', async () => {
    const localStorage = signedInStorage({ expiresAt: NOW })
    const { session, emitStorageEvent } = createTestSession({ localStorage })
    const requests = recordRequests()

    writeTokens(localStorage, storedTokens({ accessToken: 'other-tab-access-token', expiresAt: NOW + 3_600_000 }))
    emitStorageEvent(TOKENS_KEY)

    expect(await session.getAccessToken()).toBe('other-tab-access-token')
    expect(requests).toHaveLength(0)
  })

  it("keeps this tab's sign-in notice when another tab has no tokens either", async () => {
    const { session, emitStorageEvent } = createTestSession({ localStorage: createMemoryStorage() })
    await session.completeSignIn({ error: 'access_denied' })

    emitStorageEvent(TOKENS_KEY)

    expect(session.getState()).toEqual({ status: 'signedOut', notice: 'cancelled' })
  })
})
