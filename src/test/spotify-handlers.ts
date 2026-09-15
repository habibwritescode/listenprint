import { http, HttpResponse } from 'msw'
import type { JsonBodyType } from 'msw'
import { SPOTIFY_API_URL, SPOTIFY_TOKEN_URL } from '../auth/config.ts'

export const TEST_TOKENS = {
  accessToken: 'test-access-token',
  refreshedAccessToken: 'test-access-token-refreshed',
  refreshToken: 'test-refresh-token',
} as const

export const TEST_PROFILE = { id: 'test-user', type: 'user', display_name: 'Test Listener' } as const

function oauthError(error: string, status = 400) {
  return HttpResponse.json({ error, error_description: `Mock ${error}` }, { status })
}

// Rejects bodies that aren't form-encoded, so a request built with the wrong URLSearchParams realm or a
// JSON body fails here the way it would at Spotify.
const tokenEndpoint = http.post(SPOTIFY_TOKEN_URL, async ({ request }) => {
  if (request.headers.get('Content-Type') !== 'application/x-www-form-urlencoded') {
    return oauthError('invalid_request')
  }
  const params = new URLSearchParams(await request.text())
  const common = { token_type: 'Bearer', scope: 'user-library-read', expires_in: 3600 }

  switch (params.get('grant_type')) {
    case 'authorization_code':
      return HttpResponse.json({ ...common, access_token: TEST_TOKENS.accessToken, refresh_token: TEST_TOKENS.refreshToken })
    case 'refresh_token':
      return HttpResponse.json({ ...common, access_token: TEST_TOKENS.refreshedAccessToken })
    default:
      return oauthError('unsupported_grant_type')
  }
})

const profileEndpoint = http.get(`${SPOTIFY_API_URL}/me`, ({ request }) =>
  request.headers.get('Authorization')?.startsWith('Bearer ')
    ? HttpResponse.json(TEST_PROFILE)
    : HttpResponse.json({ error: { status: 401, message: 'No token provided' } }, { status: 401 }),
)

export const spotifyHandlers = [tokenEndpoint, profileEndpoint]

/** A string body is sent as HTML, anything else as JSON. */
export function tokenResponds(body: string | JsonBodyType, status = 200) {
  return http.post(SPOTIFY_TOKEN_URL, () =>
    typeof body === 'string'
      ? new HttpResponse(body, { status, headers: { 'Content-Type': 'text/html' } })
      : HttpResponse.json(body, { status }),
  )
}

export function tokenRejects(error: string) {
  return http.post(SPOTIFY_TOKEN_URL, () => oauthError(error))
}

/** A string body is sent as HTML, anything else as JSON. */
export function profileResponds(body: string | JsonBodyType, status = 200) {
  return http.get(`${SPOTIFY_API_URL}/me`, () =>
    typeof body === 'string'
      ? new HttpResponse(body, { status, headers: { 'Content-Type': 'text/html' } })
      : HttpResponse.json(body, { status }),
  )
}

export function profileForbidden() {
  return http.get(`${SPOTIFY_API_URL}/me`, () =>
    HttpResponse.json(
      { error: { status: 403, message: 'User not registered in the Developer Dashboard' } },
      { status: 403 },
    ),
  )
}

export function spotifyNetworkError(url: string) {
  return http.all(url, () => HttpResponse.error())
}
