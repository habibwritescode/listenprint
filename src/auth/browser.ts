import { SPOTIFY_CLIENT_ID, redirectUri } from './config.ts'
import { browserRandomBytes } from './pkce.ts'
import { createAuthSession } from './session.ts'
import type { AuthSession } from './session.ts'
import type { StorageLike } from './token-storage.ts'

/** The parts of `window` the session uses; `window` itself satisfies it. */
export interface BrowserEnvironment {
  location: { origin: string; assign(url: string): void }
  localStorage: StorageLike
  sessionStorage: StorageLike
  fetch: typeof fetch
  addEventListener(type: 'storage', listener: (event: { key: string | null }) => void): void
}

// Blocked site data (e.g. cookies disabled in Firefox) throws on the storage property itself, not only on
// getItem. Looking the storage up inside each call keeps that throw within token-storage's error handling
// instead of crashing the app at startup.
function lazyStorage(get: () => StorageLike): StorageLike {
  return {
    getItem: (key) => get().getItem(key),
    setItem: (key, value) => get().setItem(key, value),
    removeItem: (key) => get().removeItem(key),
  }
}

export function createBrowserAuthSession(env: BrowserEnvironment): AuthSession {
  return createAuthSession({
    clientId: SPOTIFY_CLIENT_ID,
    redirectUri: redirectUri(env.location.origin),
    fetch: (input, init) => env.fetch(input, init),
    localStorage: lazyStorage(() => env.localStorage),
    sessionStorage: lazyStorage(() => env.sessionStorage),
    now: () => Date.now(),
    randomBytes: browserRandomBytes,
    redirect: (url) => env.location.assign(url),
    // Only localStorage events reach other tabs, and the session re-reads the tokens key itself.
    onStorageEvent: (listener) => env.addEventListener('storage', (event) => listener(event.key)),
  })
}
