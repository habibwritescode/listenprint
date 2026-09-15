import type { HttpHandler } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { NOW, PROFILE_URL, REDIRECT_URI, createTestSession, requestsTo, returnFromSpotify } from '../test/auth-session.ts'
import { createMemoryStorage } from '../test/memory-storage.ts'
import type { MemoryStorage } from '../test/memory-storage.ts'
import { recordRequests, server, setupSpotifyMocks } from '../test/msw-server.ts'
import {
  TEST_TOKENS,
  profileForbidden,
  profileResponds,
  spotifyNetworkError,
  tokenRejects,
  tokenResponds,
} from '../test/spotify-handlers.ts'
import type { AuthState } from './auth-machine.ts'
import { SPOTIFY_TOKEN_URL } from './config.ts'
import { codeChallengeS256 } from './pkce.ts'
import type { CallbackParams } from './session.ts'
import { PENDING_SIGN_IN_KEY, TOKENS_KEY, readPendingSignIn } from './token-storage.ts'

setupSpotifyMocks()

describe('startSignIn', () => {
  it('stores the PKCE attempt and redirects to Spotify with its state and challenge', async () => {
    const { session, sessionStorage, redirect } = createTestSession()

    await session.startSignIn()

    const pending = readPendingSignIn(sessionStorage)
    expect(pending).toMatchObject({ createdAt: NOW })
    expect(session.getState()).toEqual({ status: 'redirecting' })
    expect(redirect).toHaveBeenCalledTimes(1)
    const url = new URL(redirect.mock.calls[0][0])
    expect(url.searchParams.get('client_id')).toBe('test-client-id')
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT_URI)
    expect(url.searchParams.get('state')).toBe(pending?.state)
    expect(url.searchParams.get('code_challenge')).toBe(await codeChallengeS256(pending?.verifier ?? ''))
  })

  // A double click must not replace the stored attempt after the first redirect was issued.
  it('ignores a second start while already redirecting', async () => {
    const { session, sessionStorage, redirect } = createTestSession()

    await Promise.all([session.startSignIn(), session.startSignIn()])

    expect(redirect).toHaveBeenCalledTimes(1)
    expect(new URL(redirect.mock.calls[0][0]).searchParams.get('state')).toBe(readPendingSignIn(sessionStorage)?.state)
  })
})

describe('subscribe', () => {
  it('notifies subscribers of each change until they unsubscribe', async () => {
    const { session } = createTestSession()
    const listener = vi.fn()
    const unsubscribe = session.subscribe(listener)

    await session.completeSignIn({ error: 'access_denied' })
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    await session.startSignIn()
    expect(session.getState()).toEqual({ status: 'redirecting' })
    expect(listener).toHaveBeenCalledTimes(2)
  })
})

describe('completeSignIn', () => {
  it('exchanges the code, verifies access, stores the tokens, and signs in', async () => {
    const { session, localStorage, sessionStorage, returnedState } = await returnFromSpotify()
    const requests = recordRequests()

    await session.completeSignIn({ code: 'test-code', state: returnedState })

    expect(session.getState()).toEqual({ status: 'signedIn', displayName: 'Test Listener' })
    expect(JSON.parse(localStorage.entries()[TOKENS_KEY])).toEqual({
      version: 1,
      accessToken: TEST_TOKENS.accessToken,
      refreshToken: TEST_TOKENS.refreshToken,
      expiresAt: NOW + 3_600_000,
      scope: 'user-library-read',
      displayName: 'Test Listener',
    })
    expect(sessionStorage.entries()).toEqual({})
    expect(requestsTo(requests, SPOTIFY_TOKEN_URL)).toHaveLength(1)
    const profileRequests = requestsTo(requests, PROFILE_URL)
    expect(profileRequests).toHaveLength(1)
    expect(profileRequests[0].headers.get('Authorization')).toBe(`Bearer ${TEST_TOKENS.accessToken}`)
  })

  it('names someone without a Spotify display name "Spotify user"', async () => {
    server.use(profileResponds({ id: 'user', display_name: null }))
    const { session, returnedState } = await returnFromSpotify()

    await session.completeSignIn({ code: 'test-code', state: returnedState })

    expect(session.getState()).toEqual({ status: 'signedIn', displayName: 'Spotify user' })
  })

  const unverified: AuthState = { status: 'signedOut', notice: 'unverified' }
  const failed: AuthState = { status: 'error' }

  const outcomes: Array<{
    name: string
    handlers?: HttpHandler[]
    params: (state: string) => CallbackParams
    expected: AuthState
    tokenRequests: number
    profileRequests: number
  }> = [
    {
      name: 'the user cancelled on Spotify',
      params: (state) => ({ error: 'access_denied', state }),
      expected: { status: 'signedOut', notice: 'cancelled' },
      tokenRequests: 0,
      profileRequests: 0,
    },
    {
      name: 'Spotify returned another error',
      params: (state) => ({ error: 'invalid_scope', state }),
      expected: unverified,
      tokenRequests: 0,
      profileRequests: 0,
    },
    {
      name: 'the state does not match the stored attempt',
      params: () => ({ code: 'test-code', state: 'forged-state' }),
      expected: unverified,
      tokenRequests: 0,
      profileRequests: 0,
    },
    {
      name: 'there is no code',
      params: (state) => ({ state }),
      expected: unverified,
      tokenRequests: 0,
      profileRequests: 0,
    },
    {
      name: 'Spotify rejects the code',
      handlers: [tokenRejects('invalid_grant')],
      params: (state) => ({ code: 'test-code', state }),
      expected: unverified,
      tokenRequests: 1,
      profileRequests: 0,
    },
    {
      name: 'the token response is malformed',
      handlers: [tokenResponds({ access_token: 'access', expires_in: 3600 })],
      params: (state) => ({ code: 'test-code', state }),
      expected: unverified,
      tokenRequests: 1,
      profileRequests: 0,
    },
    {
      name: 'the token request cannot connect',
      handlers: [spotifyNetworkError(SPOTIFY_TOKEN_URL)],
      params: (state) => ({ code: 'test-code', state }),
      expected: failed,
      tokenRequests: 1,
      profileRequests: 0,
    },
    {
      name: 'the token endpoint is unavailable',
      handlers: [tokenResponds({ error: 'server_error' }, 503)],
      params: (state) => ({ code: 'test-code', state }),
      expected: failed,
      tokenRequests: 1,
      profileRequests: 0,
    },
    {
      name: 'the account is not on the allowlist',
      handlers: [profileForbidden()],
      params: (state) => ({ code: 'test-code', state }),
      expected: { status: 'notAllowlisted' },
      tokenRequests: 1,
      profileRequests: 1,
    },
    {
      name: 'the profile request is unauthorized',
      handlers: [profileResponds({ error: { status: 401, message: 'mock' } }, 401)],
      params: (state) => ({ code: 'test-code', state }),
      expected: unverified,
      tokenRequests: 1,
      profileRequests: 1,
    },
    {
      name: 'the profile request is rate limited',
      handlers: [profileResponds({ error: { status: 429, message: 'mock' } }, 429)],
      params: (state) => ({ code: 'test-code', state }),
      expected: failed,
      tokenRequests: 1,
      profileRequests: 1,
    },
    {
      name: 'the profile request cannot connect',
      handlers: [spotifyNetworkError(PROFILE_URL)],
      params: (state) => ({ code: 'test-code', state }),
      expected: failed,
      tokenRequests: 1,
      profileRequests: 1,
    },
  ]

  it.each(outcomes)(
    'ends $expected.status when $name, stores no tokens, and deletes the attempt',
    async ({ handlers = [], params, expected, tokenRequests, profileRequests }) => {
      server.use(...handlers)
      const { session, localStorage, sessionStorage, returnedState } = await returnFromSpotify()
      const requests = recordRequests()

      await session.completeSignIn(params(returnedState))

      expect(session.getState()).toEqual(expected)
      expect(localStorage.entries()).toEqual({})
      expect(sessionStorage.entries()).toEqual({})
      expect(requestsTo(requests, SPOTIFY_TOKEN_URL)).toHaveLength(tokenRequests)
      expect(requestsTo(requests, PROFILE_URL)).toHaveLength(profileRequests)
    },
  )

  it('rejects a callback with no stored attempt without contacting Spotify', async () => {
    const { session } = createTestSession()
    const requests = recordRequests()

    await session.completeSignIn({ code: 'test-code', state: 'some-state' })

    expect(session.getState()).toEqual(unverified)
    expect(requests).toHaveLength(0)
  })

  // Authorization codes are single-use, and a route loader may run more than once.
  it('exchanges the code once when completion is requested twice for the same state', async () => {
    const { session, returnedState } = await returnFromSpotify()
    const requests = recordRequests()

    const first = session.completeSignIn({ code: 'test-code', state: returnedState })
    const second = session.completeSignIn({ code: 'test-code', state: returnedState })
    await Promise.all([first, second])

    expect(second).toBe(first)
    expect(requestsTo(requests, SPOTIFY_TOKEN_URL)).toHaveLength(1)
    expect(session.getState()).toEqual({ status: 'signedIn', displayName: 'Test Listener' })
  })

  it('stays signed in for this tab when storage refuses the tokens', async () => {
    const sessionStorage = createMemoryStorage()
    const refusingLocalStorage: MemoryStorage = {
      ...createMemoryStorage(),
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError')
      },
    }
    const leaving = createTestSession({ localStorage: refusingLocalStorage, sessionStorage })
    await leaving.session.startSignIn()
    const state = new URL(leaving.redirect.mock.calls[0][0]).searchParams.get('state') ?? ''
    const { session } = createTestSession({ localStorage: refusingLocalStorage, sessionStorage })

    await session.completeSignIn({ code: 'test-code', state })

    expect(session.getState()).toEqual({ status: 'signedIn', displayName: 'Test Listener' })
  })

  it('leaves an already signed-in session alone, contacting nobody, and deletes a stray attempt', async () => {
    const { session: signedIn, localStorage } = await returnFromSpotify().then(async (returned) => {
      await returned.session.completeSignIn({ code: 'test-code', state: returned.returnedState })
      return returned
    })
    const sessionStorage = createMemoryStorage({
      [PENDING_SIGN_IN_KEY]: JSON.stringify({ verifier: 'v', state: 's', createdAt: NOW }),
    })
    const { session } = createTestSession({ localStorage, sessionStorage })
    const requests = recordRequests()

    await session.completeSignIn({ code: 'another-code', state: 's' })

    expect(signedIn.getState()).toEqual({ status: 'signedIn', displayName: 'Test Listener' })
    expect(session.getState()).toEqual({ status: 'signedIn', displayName: 'Test Listener' })
    expect(requests).toHaveLength(0)
    expect(sessionStorage.entries()).toEqual({})
  })
})

describe('signOut', () => {
  it('clears the tokens and any pending attempt, and signs out', async () => {
    const { session, localStorage, sessionStorage, returnedState } = await returnFromSpotify()
    await session.completeSignIn({ code: 'test-code', state: returnedState })
    sessionStorage.setItem(PENDING_SIGN_IN_KEY, JSON.stringify({ verifier: 'v', state: 's', createdAt: NOW }))
    const listener = vi.fn()
    session.subscribe(listener)

    session.signOut()

    expect(session.getState()).toEqual({ status: 'signedOut' })
    expect(localStorage.entries()).toEqual({})
    expect(sessionStorage.entries()).toEqual({})
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
