// Public under PKCE: there is no client secret, so the ID is safe to ship in the bundle.
export const SPOTIFY_CLIENT_ID = '89b5cbfd620e49b7a58b41ca94da5bb8'

// display_name on GET /me needs no scope, so reading the library is the only permission requested.
export const SPOTIFY_SCOPES = ['user-library-read'] as const

export const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'

export const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'

export const SPOTIFY_API_URL = 'https://api.spotify.com/v1'

export const CALLBACK_PATH = '/callback'

/** Must match a redirect URI registered on the Spotify app exactly. */
export function redirectUri(origin: string): string {
  return `${origin}${CALLBACK_PATH}`
}

/**
 * The same page on 127.0.0.1 when it's open on localhost, where a sign-in could never come back: Spotify no longer
 * accepts localhost redirect URIs. `null` everywhere else.
 */
export function loopbackUrl(currentUrl: string): string | null {
  const url = new URL(currentUrl)
  if (url.hostname !== 'localhost') return null
  url.hostname = '127.0.0.1'
  return url.href
}
