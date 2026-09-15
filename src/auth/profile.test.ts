import { describe, expect, it } from 'vitest'
import { recordRequests, server, setupSpotifyMocks } from '../test/msw-server.ts'
import { profileForbidden, profileResponds, spotifyNetworkError } from '../test/spotify-handlers.ts'
import { SPOTIFY_API_URL } from './config.ts'
import { fetchDisplayName } from './profile.ts'

setupSpotifyMocks()

const PROFILE_URL = `${SPOTIFY_API_URL}/me`

// Unbound, like a browser's fetch; see accounts.test.ts.
const send: typeof fetch = function (this: unknown, input, init) {
  if (this !== undefined) throw new TypeError('Illegal invocation')
  return fetch(input, init)
}

describe('fetchDisplayName', () => {
  it("reads the display name from the current user's profile with the access token", async () => {
    const requests = recordRequests()

    const result = await fetchDisplayName(send, 'test-access-token')

    expect(result).toEqual({ ok: true, displayName: 'Test Listener' })
    expect(requests).toHaveLength(1)
    expect(requests[0].method).toBe('GET')
    expect(requests[0].url).toBe(PROFILE_URL)
    expect(requests[0].headers.get('Authorization')).toBe('Bearer test-access-token')
  })

  it.each([
    ['null', { id: 'user', display_name: null }],
    ['missing', { id: 'user' }],
    ['empty', { id: 'user', display_name: '' }],
  ])('returns no display name when it is %s', async (_case, body) => {
    server.use(profileResponds(body))

    expect(await fetchDisplayName(send, 'token')).toEqual({ ok: true, displayName: null })
  })

  it('reports 403 as forbidden: the account is not on the app allowlist', async () => {
    server.use(profileForbidden())

    expect(await fetchDisplayName(send, 'token')).toEqual({ ok: false, reason: 'forbidden' })
  })

  it.each([
    [401, 'rejected'],
    [404, 'rejected'],
    [429, 'unavailable'],
    [500, 'unavailable'],
    [503, 'unavailable'],
  ] as const)('reports %i as %s', async (status, reason) => {
    server.use(profileResponds({ error: { status, message: 'mock' } }, status))

    expect(await fetchDisplayName(send, 'token')).toEqual({ ok: false, reason })
  })

  it('reports a failed connection as a network failure', async () => {
    server.use(spotifyNetworkError(PROFILE_URL))

    expect(await fetchDisplayName(send, 'token')).toEqual({ ok: false, reason: 'network' })
  })

  it.each([
    ['a non-JSON body', '<html>ok</html>'],
    ['a non-object', []],
    ['a display name that is not a string', { id: 'user', display_name: 42 }],
  ])('reports a success response with %s as malformed', async (_case, body) => {
    server.use(profileResponds(body))

    expect(await fetchDisplayName(send, 'token')).toEqual({ ok: false, reason: 'malformed' })
  })
})
