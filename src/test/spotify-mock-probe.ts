import { describe, expect, it } from 'vitest'
import { SPOTIFY_API_URL, SPOTIFY_TOKEN_URL } from '../auth/config.ts'
import { server, setupSpotifyMocks } from './msw-server.ts'
import { profileForbidden, spotifyNetworkError, TEST_TOKENS, tokenRejects } from './spotify-handlers.ts'

function postToken(params: Record<string, string>) {
  return fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })
}

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

// The same probe runs in Node and in jsdom: jsdom swaps in its own globals (URLSearchParams,
// TextEncoder), and auth code must work with whichever the environment provides.
export function describeSpotifyMockProbe(environment: 'node' | 'jsdom') {
  describe(`Spotify mocks and Web Crypto (${environment})`, () => {
    setupSpotifyMocks()

    it('answers a form-encoded authorization code exchange', async () => {
      const response = await postToken({ grant_type: 'authorization_code', code: 'test-code', code_verifier: 'v' })

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        access_token: TEST_TOKENS.accessToken,
        refresh_token: TEST_TOKENS.refreshToken,
        expires_in: 3600,
      })
    })

    it('answers a refresh without a new refresh token, as Spotify may', async () => {
      const response = await postToken({ grant_type: 'refresh_token', refresh_token: TEST_TOKENS.refreshToken })

      const body = await response.json()
      expect(body.access_token).toBe(TEST_TOKENS.refreshedAccessToken)
      expect(body).not.toHaveProperty('refresh_token')
    })

    it('returns the profile only with a bearer token', async () => {
      const authorized = await fetch(`${SPOTIFY_API_URL}/me`, {
        headers: { Authorization: `Bearer ${TEST_TOKENS.accessToken}` },
      })
      const anonymous = await fetch(`${SPOTIFY_API_URL}/me`)

      expect(await authorized.json()).toMatchObject({ display_name: 'Test Listener' })
      expect(anonymous.status).toBe(401)
    })

    it('lets a test override the token endpoint, the profile, and the network', async () => {
      server.use(tokenRejects('invalid_grant'), profileForbidden())

      const rejected = await postToken({ grant_type: 'refresh_token', refresh_token: 'old' })
      expect(rejected.status).toBe(400)
      expect(await rejected.json()).toMatchObject({ error: 'invalid_grant' })

      const forbidden = await fetch(`${SPOTIFY_API_URL}/me`, { headers: { Authorization: 'Bearer x' } })
      expect(forbidden.status).toBe(403)

      server.use(spotifyNetworkError(SPOTIFY_TOKEN_URL))
      await expect(postToken({ grant_type: 'refresh_token', refresh_token: 'old' })).rejects.toThrow(TypeError)
    })

    it('fails a request no handler covers instead of reaching the network', async () => {
      // Matched on MSW's message: a sandbox without network would also reject, which proves nothing.
      await expect(fetch(`${SPOTIFY_API_URL}/me/tracks`)).rejects.toThrow(/onUnhandledRequest/)
    })

    it('provides random bytes and SHA-256', async () => {
      const bytes = crypto.getRandomValues(new Uint8Array(48))
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('abc'))

      expect(bytes).toHaveLength(48)
      expect(hex(digest)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    })
  })
}
