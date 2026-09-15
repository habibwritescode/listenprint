import { vi } from 'vitest'
import { SPOTIFY_API_URL } from '../auth/config.ts'
import { browserRandomBytes } from '../auth/pkce.ts'
import { createAuthSession } from '../auth/session.ts'
import { TOKENS_KEY } from '../auth/token-storage.ts'
import type { StoredTokens } from '../auth/token-storage.ts'
import { createMemoryStorage } from './memory-storage.ts'
import type { MemoryStorage } from './memory-storage.ts'
import type { RecordedRequest } from './msw-server.ts'

export const NOW = 1_800_000_000_000
export const REDIRECT_URI = 'http://127.0.0.1:5173/callback'
export const PROFILE_URL = `${SPOTIFY_API_URL}/me`

interface TestSessionOptions {
  localStorage?: MemoryStorage
  sessionStorage?: MemoryStorage
}

/** A session with in-memory storage, a fixed clock, a spy for the redirect, and a way to fake other tabs. */
export function createTestSession({
  localStorage = createMemoryStorage(),
  sessionStorage = createMemoryStorage(),
}: TestSessionOptions = {}) {
  const redirect = vi.fn<(url: string) => void>()
  const storageListeners: Array<(key: string | null) => void> = []
  const session = createAuthSession({
    clientId: 'test-client-id',
    redirectUri: REDIRECT_URI,
    fetch: (input, init) => fetch(input, init),
    localStorage,
    sessionStorage,
    now: () => NOW,
    randomBytes: browserRandomBytes,
    redirect,
    onStorageEvent: (listener) => {
      storageListeners.push(listener)
    },
  })
  /** What another tab changing `localStorage` looks like to this one. */
  const emitStorageEvent = (key: string | null) => {
    for (const listener of storageListeners) listener(key)
  }
  return { session, localStorage, sessionStorage, redirect, emitStorageEvent }
}

// Starts sign-in, then returns a new session sharing the tab's storage: Spotify's redirect back is a fresh
// page load.
export async function returnFromSpotify(localStorage = createMemoryStorage()) {
  const sessionStorage = createMemoryStorage()
  const leaving = createTestSession({ localStorage, sessionStorage })
  await leaving.session.startSignIn()
  const authorizeUrl = new URL(leaving.redirect.mock.calls[0][0])
  const returnedState = authorizeUrl.searchParams.get('state') ?? ''
  return { ...createTestSession({ localStorage, sessionStorage }), returnedState }
}

export function requestsTo(requests: RecordedRequest[], url: string) {
  return requests.filter((request) => request.url === url)
}

export function storedTokens(overrides: Partial<StoredTokens> = {}): StoredTokens {
  return {
    accessToken: 'stored-access-token',
    refreshToken: 'stored-refresh-token',
    expiresAt: NOW + 3_600_000,
    scope: 'user-library-read',
    displayName: 'Stored Listener',
    ...overrides,
  }
}

/** localStorage contents for a signed-in tab. */
export function signedInStorage(overrides: Partial<StoredTokens> = {}): MemoryStorage {
  return createMemoryStorage({ [TOKENS_KEY]: JSON.stringify({ version: 1, ...storedTokens(overrides) }) })
}
