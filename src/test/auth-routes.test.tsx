// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { SPOTIFY_TOKEN_URL } from '../auth/config.ts'
import { writePendingSignIn } from '../auth/token-storage.ts'
import { NOW, createTestSession, returnFromSpotify, signedInStorage } from './auth-session.ts'
import { createMemoryStorage } from './memory-storage.ts'
import { recordRequests, server, setupSpotifyMocks } from './msw-server.ts'
import { renderApp } from './render-app.ts'

setupSpotifyMocks()

afterEach(cleanup)

describe('/callback', () => {
  it('completes sign-in, then replaces the callback URL with the home page', async () => {
    const { session, sessionStorage, returnedState } = await returnFromSpotify()

    const { router } = renderApp(`/callback?code=test-code&state=${returnedState}`, { auth: session })

    expect(await screen.findByRole('heading', { level: 1, name: 'Connected as Test Listener.' })).toBeDefined()
    expect(router.state.location.pathname).toBe('/')
    expect(router.state.location.searchStr).toBe('')
    // Replaced, not pushed: Back must not return to a spent code.
    expect(router.history.length).toBe(1)
    expect(session.getState()).toEqual({ status: 'signedIn', displayName: 'Test Listener' })
    expect(sessionStorage.entries()).toEqual({})
  })

  it('shows a status while connecting to Spotify', async () => {
    let release = () => {}
    const released = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.post(SPOTIFY_TOKEN_URL, async () => {
        await released
        return HttpResponse.json({ access_token: 'a', refresh_token: 'r', expires_in: 3600, scope: 's' })
      }),
    )
    const { session, returnedState } = await returnFromSpotify()
    const { router } = renderApp(`/callback?code=test-code&state=${returnedState}`, { auth: session })

    const status = await screen.findByRole('status', { name: 'Connecting to Spotify…' })
    expect(status.textContent).toContain('your library hasn’t been read yet')

    release()
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('returns home as unverified when no sign-in attempt is in progress, without contacting Spotify', async () => {
    const { session } = createTestSession()
    const requests = recordRequests()

    const { router } = renderApp('/callback?code=test-code&state=unknown-state', { auth: session })

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(session.getState()).toEqual({ status: 'signedOut', notice: 'unverified' })
    expect(requests).toHaveLength(0)
  })

  it('returns home as cancelled when the user declined on Spotify', async () => {
    const { session, returnedState } = await returnFromSpotify()

    const { router } = renderApp(`/callback?error=access_denied&state=${returnedState}`, { auth: session })

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(session.getState()).toEqual({ status: 'signedOut', notice: 'cancelled' })
  })

  it('returns home and leaves a signed-in session alone', async () => {
    const { session } = createTestSession({ localStorage: signedInStorage() })
    const requests = recordRequests()

    const { router } = renderApp('/callback?code=test-code&state=some-state', { auth: session })

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(session.getState()).toEqual({ status: 'signedIn', displayName: 'Stored Listener' })
    expect(requests).toHaveLength(0)
  })

  // The router's default search parsing rounded this to 12345678901234567000, failing the state check.
  it('matches a state made only of digits as text', async () => {
    const sessionStorage = createMemoryStorage()
    writePendingSignIn(sessionStorage, { verifier: 'test-verifier', state: '12345678901234567890', createdAt: NOW })
    const { session } = createTestSession({ sessionStorage })

    const { router } = renderApp('/callback?code=test-code&state=12345678901234567890', { auth: session })

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(session.getState()).toEqual({ status: 'signedIn', displayName: 'Test Listener' })
  })
})
