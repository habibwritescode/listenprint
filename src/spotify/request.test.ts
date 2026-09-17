import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { SPOTIFY_API_URL, SPOTIFY_TOKEN_URL } from '../auth/config.ts'
import { AuthTokenError } from '../auth/session.ts'
import { createTestSession, requestsTo, signedInStorage } from '../test/auth-session.ts'
import { recordRequests, server, setupSpotifyMocks } from '../test/msw-server.ts'
import { TEST_TOKENS, spotifyNetworkError, tokenRejects } from '../test/spotify-handlers.ts'
import { networkErrorOnce, respondOnceWith } from '../test/spotify-library-handlers.ts'
import { SpotifyRequestError, createSpotifyRequest } from './request.ts'

setupSpotifyMocks()

const PATH = '/me/tracks?limit=50&offset=0'
const TRACKS_PAGE_URL = `${SPOTIFY_API_URL}${PATH}`
const PAGE = { items: [], total: 0 }

function succeeds() {
  return http.get(`${SPOTIFY_API_URL}/me/tracks`, () => HttpResponse.json(PAGE))
}

function signedInRequest({ random = () => 0.5 } = {}) {
  const { session } = createTestSession({ localStorage: signedInStorage() })
  const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined)
  const request = createSpotifyRequest({ auth: session, fetch: (input, init) => fetch(input, init), sleep, random })
  return { request, sleep, session }
}

async function failure(promise: Promise<unknown>): Promise<SpotifyRequestError> {
  const error = await promise.then(
    () => {
      throw new Error('expected the request to fail')
    },
    (reason: unknown) => reason,
  )
  if (!(error instanceof SpotifyRequestError)) throw error
  return error
}

describe('createSpotifyRequest', () => {
  it('sends the access token and returns the parsed body', async () => {
    server.use(succeeds())
    const requests = recordRequests()
    const { request } = signedInRequest()

    await expect(request(PATH)).resolves.toEqual(PAGE)

    expect(requests).toHaveLength(1)
    expect(requests[0].url).toBe(TRACKS_PAGE_URL)
    expect(requests[0].headers.get('Authorization')).toBe('Bearer stored-access-token')
  })

  it('refreshes once after a 401 and retries with the new token', async () => {
    server.use(respondOnceWith(TRACKS_PAGE_URL, 401), succeeds())
    const requests = recordRequests()
    const { request, sleep } = signedInRequest()

    await expect(request(PATH)).resolves.toEqual(PAGE)

    expect(requestsTo(requests, SPOTIFY_TOKEN_URL)).toHaveLength(1)
    const retried = requestsTo(requests, TRACKS_PAGE_URL)
    expect(retried.map((sent) => sent.headers.get('Authorization'))).toEqual([
      'Bearer stored-access-token',
      `Bearer ${TEST_TOKENS.refreshedAccessToken}`,
    ])
    expect(sleep).not.toHaveBeenCalled()
  })

  // The old app refreshed and retried on every 401 with no limit.
  it('fails as expired on a second 401 instead of refreshing again', async () => {
    server.use(http.get(`${SPOTIFY_API_URL}/me/tracks`, () => new HttpResponse(null, { status: 401 })))
    const requests = recordRequests()
    const { request } = signedInRequest()

    const error = await failure(request(PATH))

    expect(error.reason).toBe('expired')
    expect(error.status).toBe(401)
    expect(requestsTo(requests, SPOTIFY_TOKEN_URL)).toHaveLength(1)
    expect(requestsTo(requests, TRACKS_PAGE_URL)).toHaveLength(2)
  })

  it('passes auth failures through unchanged', async () => {
    server.use(respondOnceWith(TRACKS_PAGE_URL, 401), tokenRejects('invalid_grant'))
    const { request, session } = signedInRequest()

    await expect(request(PATH)).rejects.toMatchObject({ name: 'AuthTokenError', reason: 'expired' })
    expect(session.getState()).toEqual({ status: 'signedOut', notice: 'expired' })
  })

  it('makes no request when signed out', async () => {
    const requests = recordRequests()
    const { session } = createTestSession()
    const request = createSpotifyRequest({ auth: session, fetch, sleep: vi.fn(), random: Math.random })

    await expect(request(PATH)).rejects.toBeInstanceOf(AuthTokenError)
    expect(requests).toHaveLength(0)
  })

  it('waits for Retry-After on a 429 and retries', async () => {
    server.use(respondOnceWith(TRACKS_PAGE_URL, 429, { headers: { 'Retry-After': '2' } }), succeeds())
    const { request, sleep } = signedInRequest()

    await expect(request(PATH)).resolves.toEqual(PAGE)

    expect(sleep).toHaveBeenCalledExactlyOnceWith(2_000)
  })

  it.each([
    ['no body', null],
    ['a body that is not an object', JSON.stringify('slow down')],
  ])('treats a 429 with %s as a plain rate limit', async (_case, body) => {
    server.use(
      http.get(TRACKS_PAGE_URL, () => new HttpResponse(body, { status: 429, headers: { 'Retry-After': '1' } }), {
        once: true,
      }),
      succeeds(),
    )
    const { request, sleep } = signedInRequest()

    await expect(request(PATH)).resolves.toEqual(PAGE)

    expect(sleep).toHaveBeenCalledExactlyOnceWith(1_000)
  })

  it('backs off with jitter on a 429 without Retry-After', async () => {
    server.use(respondOnceWith(TRACKS_PAGE_URL, 429), succeeds())
    const { request, sleep } = signedInRequest({ random: () => 0.5 })

    await expect(request(PATH)).resolves.toEqual(PAGE)

    expect(sleep).toHaveBeenCalledExactlyOnceWith(500)
  })

  it('stops with the wait when Spotify asks for more than a minute', async () => {
    server.use(respondOnceWith(TRACKS_PAGE_URL, 429, { headers: { 'Retry-After': '120' } }))
    const requests = recordRequests()
    const { request, sleep } = signedInRequest()

    const error = await failure(request(PATH))

    expect(error).toMatchObject({ reason: 'rateLimited', retryAfterMs: 120_000, quotaExceeded: false, status: 429 })
    expect(sleep).not.toHaveBeenCalled()
    expect(requestsTo(requests, TRACKS_PAGE_URL)).toHaveLength(1)
  })

  it.each([
    ['at the top level', { reason: 'QUOTA_EXCEEDED' }],
    ['inside the error object', { error: { status: 429, message: 'Quota exceeded', reason: 'QUOTA_EXCEEDED' } }],
  ])('stops without retrying when the quota is exceeded, with the reason %s', async (_place, body) => {
    server.use(respondOnceWith(TRACKS_PAGE_URL, 429, { headers: { 'Retry-After': '5' }, body }))
    const { request, sleep } = signedInRequest()

    const error = await failure(request(PATH))

    expect(error).toMatchObject({ reason: 'rateLimited', quotaExceeded: true, retryAfterMs: 5_000 })
    expect(sleep).not.toHaveBeenCalled()
  })

  it('retries server errors with growing jittered delays', async () => {
    server.use(
      respondOnceWith(TRACKS_PAGE_URL, 503),
      respondOnceWith(TRACKS_PAGE_URL, 500),
      networkErrorOnce(TRACKS_PAGE_URL),
      succeeds(),
    )
    const { request, sleep } = signedInRequest({ random: () => 0.5 })

    await expect(request(PATH)).resolves.toEqual(PAGE)

    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([500, 1_000, 2_000])
  })

  it('fails as unavailable after four retries of a server error', async () => {
    server.use(http.get(`${SPOTIFY_API_URL}/me/tracks`, () => new HttpResponse(null, { status: 502 })))
    const requests = recordRequests()
    const { request, sleep } = signedInRequest()

    const error = await failure(request(PATH))

    expect(error).toMatchObject({ reason: 'unavailable', status: 502 })
    expect(requestsTo(requests, TRACKS_PAGE_URL)).toHaveLength(5)
    expect(sleep).toHaveBeenCalledTimes(4)
  })

  it('fails as unavailable with no status when the network keeps failing', async () => {
    server.use(spotifyNetworkError(`${SPOTIFY_API_URL}/me/tracks`))
    const { request } = signedInRequest()

    const error = await failure(request(PATH))

    expect(error).toMatchObject({ reason: 'unavailable', status: null })
  })

  it.each([
    [403, 'forbidden'],
    [404, 'rejected'],
    [400, 'rejected'],
  ] as const)('fails on a %i as %s without retrying', async (status, reason) => {
    server.use(respondOnceWith(TRACKS_PAGE_URL, status))
    const requests = recordRequests()
    const { request, sleep } = signedInRequest()

    const error = await failure(request(PATH))

    expect(error).toMatchObject({ reason, status })
    expect(requestsTo(requests, TRACKS_PAGE_URL)).toHaveLength(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('fails as malformed when a successful response is not JSON', async () => {
    server.use(http.get(`${SPOTIFY_API_URL}/me/tracks`, () => new HttpResponse('<html>', { status: 200 })))
    const { request } = signedInRequest()

    const error = await failure(request(PATH))

    expect(error).toMatchObject({ reason: 'malformed', status: 200 })
  })

  it('never puts a token in an error', async () => {
    server.use(http.get(`${SPOTIFY_API_URL}/me/tracks`, () => new HttpResponse(null, { status: 401 })))
    const { request } = signedInRequest()

    const error = await failure(request(PATH))

    for (const text of [error.message, String(error), JSON.stringify(error)]) {
      expect(text).not.toContain('stored-access-token')
      expect(text).not.toContain(TEST_TOKENS.refreshedAccessToken)
    }
  })
})
