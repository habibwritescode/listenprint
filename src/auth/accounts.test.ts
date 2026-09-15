import { describe, expect, it } from 'vitest'
import { recordRequests, server, setupSpotifyMocks } from '../test/msw-server.ts'
import { spotifyNetworkError, TEST_TOKENS, tokenRejects, tokenResponds } from '../test/spotify-handlers.ts'
import { buildAuthorizeUrl, exchangeCode, refreshTokens } from './accounts.ts'
import type { TokenClient } from './accounts.ts'
import { SPOTIFY_CLIENT_ID, SPOTIFY_TOKEN_URL, redirectUri } from './config.ts'

setupSpotifyMocks()

const NOW = 1_800_000_000_000

// Called the way the session will call it. A browser's fetch throws "Illegal invocation" when called as a
// method of another object, so this fails if the client is ever used as `client.fetch(...)`.
const client: TokenClient = {
  clientId: 'test-client-id',
  now: () => NOW,
  fetch: function (this: unknown, input, init) {
    if (this !== undefined) throw new TypeError('Illegal invocation')
    return fetch(input, init)
  },
}

const exchange = () =>
  exchangeCode(client, { code: 'test-code', redirectUri: 'http://127.0.0.1:5173/callback', codeVerifier: 'test-verifier' })

async function formBody(request: { body: Promise<string> }) {
  return Object.fromEntries(new URLSearchParams(await request.body))
}

describe('redirectUri', () => {
  it.each([
    ['http://127.0.0.1:5173', 'http://127.0.0.1:5173/callback'],
    ['http://127.0.0.1:4173', 'http://127.0.0.1:4173/callback'],
    ['https://listenprint.vercel.app', 'https://listenprint.vercel.app/callback'],
  ])('is %s/callback', (origin, expected) => {
    expect(redirectUri(origin)).toBe(expected)
  })
})

describe('buildAuthorizeUrl', () => {
  const url = new URL(
    buildAuthorizeUrl({
      clientId: SPOTIFY_CLIENT_ID,
      redirectUri: 'http://127.0.0.1:5173/callback',
      state: 'test-state',
      codeChallenge: 'test-challenge',
    }),
  )

  it("targets Spotify's authorize endpoint", () => {
    expect(`${url.origin}${url.pathname}`).toBe('https://accounts.spotify.com/authorize')
  })

  it('sends exactly the PKCE authorization parameters, asking only to read the library', () => {
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: '89b5cbfd620e49b7a58b41ca94da5bb8',
      scope: 'user-library-read',
      redirect_uri: 'http://127.0.0.1:5173/callback',
      state: 'test-state',
      code_challenge_method: 'S256',
      code_challenge: 'test-challenge',
    })
    expect([...url.searchParams.keys()]).toHaveLength(7)
  })
})

describe('exchangeCode', () => {
  it('posts exactly the PKCE token parameters as a form', async () => {
    const requests = recordRequests()

    await exchange()

    expect(requests).toHaveLength(1)
    expect(requests[0].method).toBe('POST')
    expect(requests[0].url).toBe(SPOTIFY_TOKEN_URL)
    expect(requests[0].headers.get('Content-Type')).toBe('application/x-www-form-urlencoded')
    expect(await formBody(requests[0])).toEqual({
      grant_type: 'authorization_code',
      code: 'test-code',
      redirect_uri: 'http://127.0.0.1:5173/callback',
      client_id: 'test-client-id',
      code_verifier: 'test-verifier',
    })
  })

  it('returns the tokens with an absolute expiry', async () => {
    expect(await exchange()).toEqual({
      ok: true,
      tokens: {
        accessToken: TEST_TOKENS.accessToken,
        refreshToken: TEST_TOKENS.refreshToken,
        expiresAt: NOW + 3_600_000,
        scope: 'user-library-read',
      },
    })
  })

  it('treats a response without a refresh token as malformed, since the session could not be renewed', async () => {
    server.use(tokenResponds({ access_token: 'access', expires_in: 3600, scope: 'user-library-read' }))

    expect(await exchange()).toEqual({ ok: false, reason: 'malformed' })
  })
})

describe('refreshTokens', () => {
  it('posts exactly the refresh parameters as a form', async () => {
    const requests = recordRequests()

    await refreshTokens(client, 'old-refresh-token')

    expect(requests).toHaveLength(1)
    expect(requests[0].headers.get('Content-Type')).toBe('application/x-www-form-urlencoded')
    expect(await formBody(requests[0])).toEqual({
      grant_type: 'refresh_token',
      refresh_token: 'old-refresh-token',
      client_id: 'test-client-id',
    })
  })

  it('returns no refresh token when Spotify sends none, so the caller keeps the old one', async () => {
    expect(await refreshTokens(client, 'old-refresh-token')).toEqual({
      ok: true,
      tokens: {
        accessToken: TEST_TOKENS.refreshedAccessToken,
        refreshToken: null,
        expiresAt: NOW + 3_600_000,
        scope: 'user-library-read',
      },
    })
  })

  it('returns a new refresh token when Spotify rotates it', async () => {
    server.use(tokenResponds({ access_token: 'access', refresh_token: 'rotated', expires_in: 60, scope: 's' }))

    const result = await refreshTokens(client, 'old-refresh-token')

    expect(result).toEqual({
      ok: true,
      tokens: { accessToken: 'access', refreshToken: 'rotated', expiresAt: NOW + 60_000, scope: 's' },
    })
  })
})

describe('token request failures', () => {
  const requestKinds = [
    ['exchangeCode', exchange],
    ['refreshTokens', () => refreshTokens(client, 'old-refresh-token')],
  ] as const

  describe.each(requestKinds)('%s', (_name, request) => {
    it('reports an OAuth error from Spotify, such as an expired refresh token', async () => {
      server.use(tokenRejects('invalid_grant'))

      expect(await request()).toEqual({ ok: false, reason: 'rejected', error: 'invalid_grant' })
    })

    it('reports a client error without an OAuth body by its status', async () => {
      server.use(tokenResponds('<html>Forbidden</html>', 403))

      expect(await request()).toEqual({ ok: false, reason: 'rejected', error: 'http_403' })
    })

    // Kept apart from rejections: Spotify being down must not sign anyone out.
    it('reports a server error as unavailable', async () => {
      server.use(tokenResponds({ error: 'server_error' }, 503))

      expect(await request()).toEqual({ ok: false, reason: 'unavailable', status: 503 })
    })

    it('reports a failed connection as a network failure', async () => {
      server.use(spotifyNetworkError(SPOTIFY_TOKEN_URL))

      expect(await request()).toEqual({ ok: false, reason: 'network' })
    })

    it.each([
      ['a non-JSON body', '<html>ok</html>'],
      ['a non-object', []],
      ['no access token', { refresh_token: 'refresh', expires_in: 3600 }],
      ['an empty access token', { access_token: '', refresh_token: 'refresh', expires_in: 3600 }],
      ['no expiry', { access_token: 'access', refresh_token: 'refresh' }],
      ['a zero expiry', { access_token: 'access', refresh_token: 'refresh', expires_in: 0 }],
      ['an expiry as a string', { access_token: 'access', refresh_token: 'refresh', expires_in: '3600' }],
      ['a refresh token that is not a string', { access_token: 'access', refresh_token: 42, expires_in: 3600 }],
    ])('reports a success response with %s as malformed', async (_case, body) => {
      server.use(tokenResponds(body))

      expect(await request()).toEqual({ ok: false, reason: 'malformed' })
    })
  })

  it('accepts a success response without a scope, as an empty scope', async () => {
    server.use(tokenResponds({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600 }))

    expect(await exchange()).toMatchObject({ ok: true, tokens: { scope: '' } })
  })
})
