import { describe, expect, it, vi } from 'vitest'
import { signedInStorage } from '../test/auth-session.ts'
import { createMemoryStorage } from '../test/memory-storage.ts'
import { createBrowserAuthSession } from './browser.ts'
import type { BrowserEnvironment } from './browser.ts'
import { SPOTIFY_CLIENT_ID, SPOTIFY_TOKEN_URL } from './config.ts'
import { TOKENS_KEY, readPendingSignIn } from './token-storage.ts'

function fakeBrowser(overrides: Partial<BrowserEnvironment> = {}) {
  const storageListeners: Array<(event: { key: string | null }) => void> = []
  const assign = vi.fn<(url: string) => void>()
  const pageFetch = vi.fn<typeof fetch>(async () =>
    Response.json({ access_token: 'refreshed-access-token', expires_in: 3600, scope: 'user-library-read' }),
  )
  const env: BrowserEnvironment = {
    location: { origin: 'http://127.0.0.1:5173', assign },
    localStorage: createMemoryStorage(),
    sessionStorage: createMemoryStorage(),
    fetch: pageFetch,
    addEventListener: (_type, listener) => {
      storageListeners.push(listener)
    },
    ...overrides,
  }
  const fireStorageEvent = (key: string | null) => {
    for (const listener of storageListeners) listener({ key })
  }
  return { env, assign, pageFetch, fireStorageEvent }
}

describe('createBrowserAuthSession', () => {
  it("redirects to Spotify with the embedded client ID and a callback on the page's origin", async () => {
    const { env, assign } = fakeBrowser()
    const session = createBrowserAuthSession(env)

    await session.startSignIn()

    const url = new URL(assign.mock.calls[0][0])
    expect(url.searchParams.get('client_id')).toBe(SPOTIFY_CLIENT_ID)
    expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:5173/callback')
    expect(readPendingSignIn(env.sessionStorage)?.state).toBe(url.searchParams.get('state'))
  })

  it("starts signed in from the page's localStorage, and signing out clears it", () => {
    const localStorage = signedInStorage()
    const { env } = fakeBrowser({ localStorage })
    const session = createBrowserAuthSession(env)

    expect(session.getState()).toEqual({ status: 'signedIn', displayName: 'Stored Listener' })

    session.signOut()
    expect(localStorage.entries()).toEqual({})
  })

  it('hands out a stored token that has not expired by the real clock, without fetching', async () => {
    const { env, pageFetch } = fakeBrowser({ localStorage: signedInStorage({ expiresAt: Date.now() + 3_600_000 }) })

    expect(await createBrowserAuthSession(env).getAccessToken()).toBe('stored-access-token')
    expect(pageFetch).not.toHaveBeenCalled()
  })

  it("refreshes an expired token through the page's fetch", async () => {
    const { env, pageFetch } = fakeBrowser({ localStorage: signedInStorage({ expiresAt: 0 }) })

    expect(await createBrowserAuthSession(env).getAccessToken()).toBe('refreshed-access-token')
    expect(pageFetch).toHaveBeenCalledWith(SPOTIFY_TOKEN_URL, expect.objectContaining({ method: 'POST' }))
  })

  it('follows a sign-out in another tab through storage events', () => {
    const localStorage = signedInStorage()
    const { env, fireStorageEvent } = fakeBrowser({ localStorage })
    const session = createBrowserAuthSession(env)

    localStorage.removeItem(TOKENS_KEY)
    fireStorageEvent(TOKENS_KEY)

    expect(session.getState()).toEqual({ status: 'signedOut' })
  })

  // Some browsers throw on the storage property itself when site data is blocked.
  it('starts signed out instead of crashing when the browser blocks storage', async () => {
    const { env } = fakeBrowser()
    const blocked = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    }
    Object.defineProperty(env, 'localStorage', { get: blocked })
    Object.defineProperty(env, 'sessionStorage', { get: blocked })

    const session = createBrowserAuthSession(env)

    expect(session.getState()).toEqual({ status: 'signedOut' })
    await expect(session.startSignIn()).rejects.toThrow('insecure')
    expect(session.getState()).toEqual({ status: 'signedOut' })
  })
})
