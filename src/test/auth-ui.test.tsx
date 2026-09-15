// @vitest-environment jsdom
// @vitest-environment-options {"url": "http://127.0.0.1:5173/"}
import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { SPOTIFY_TOKEN_URL } from '../auth/config.ts'
import type { AuthSession } from '../auth/session.ts'
import { NOW, createTestSession, returnFromSpotify, signedInStorage } from './auth-session.ts'
import { expectNoAxeViolations } from './axe.ts'
import { createMemoryStorage } from './memory-storage.ts'
import type { MemoryStorage } from './memory-storage.ts'
import { server, setupSpotifyMocks } from './msw-server.ts'
import { renderApp } from './render-app.ts'
import { profileForbidden, spotifyNetworkError, tokenRejects } from './spotify-handlers.ts'

setupSpotifyMocks()

afterEach(cleanup)

async function renderHome(auth: AuthSession) {
  const view = renderApp('/', { auth })
  await screen.findByRole('heading', { level: 1, name: 'Your artist rankings' })
  return view
}

describe('home page, signed out', () => {
  it('connects to Spotify, and shows the button as busy while leaving', async () => {
    const user = userEvent.setup()
    const { session, redirect } = createTestSession()
    await renderHome(session)

    await user.click(screen.getByRole('button', { name: 'Connect Spotify' }))

    expect(redirect).toHaveBeenCalledTimes(1)
    const url = new URL(redirect.mock.calls[0][0])
    expect(`${url.origin}${url.pathname}`).toBe('https://accounts.spotify.com/authorize')
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Opening Spotify…' }).disabled).toBe(true)
  })

  it('offers the demo, with no accessibility violations', async () => {
    const { container } = await renderHome(createTestSession().session)

    expect(screen.getByRole('link', { name: 'Try the demo' }).getAttribute('href')).toBe('/demo')
    await expectNoAxeViolations(container)
  })

  // Blocked site data makes storing the PKCE attempt throw before anything leaves the page.
  it('explains when sign-in cannot start because the browser blocks site storage', async () => {
    const user = userEvent.setup()
    const refusingSessionStorage: MemoryStorage = {
      ...createMemoryStorage(),
      setItem: () => {
        throw new DOMException('blocked', 'SecurityError')
      },
    }
    const { session, redirect } = createTestSession({ sessionStorage: refusingSessionStorage })
    await renderHome(session)

    await user.click(screen.getByRole('button', { name: 'Connect Spotify' }))

    expect((await screen.findByRole('alert')).textContent).toBe(
      "Couldn't start Spotify sign-in. Sign-in needs this site to be allowed to store data.",
    )
    expect(redirect).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Connect Spotify' })).toBeDefined()
  })
})

describe('home page notices', () => {
  it.each([
    [
      'cancelled',
      async () => {
        const { session } = createTestSession()
        await session.completeSignIn({ error: 'access_denied' })
        return session
      },
      'Spotify sign-in was cancelled.',
    ],
    [
      'unverified',
      async () => {
        const { session } = createTestSession()
        await session.completeSignIn({ code: 'test-code', state: 'unknown-state' })
        return session
      },
      "We couldn't verify that sign-in. Please try again.",
    ],
    [
      'expired',
      async () => {
        server.use(tokenRejects('invalid_grant'))
        const { session } = createTestSession({ localStorage: signedInStorage({ expiresAt: NOW }) })
        await session.getAccessToken().catch(() => {})
        return session
      },
      'Your Spotify session has ended. Connect again to continue.',
    ],
  ])('shows the %s notice with a way to connect again', async (_notice, setUp, message) => {
    const { container } = await renderHome(await setUp())

    expect(screen.getByRole('status').textContent).toBe(message)
    expect(screen.getByRole('button', { name: 'Connect Spotify' })).toBeDefined()
    await expectNoAxeViolations(container)
  })

  it('offers to try again when Spotify could not be reached to finish signing in', async () => {
    const user = userEvent.setup()
    server.use(spotifyNetworkError(SPOTIFY_TOKEN_URL))
    const { session, redirect, returnedState } = await returnFromSpotify()
    await session.completeSignIn({ code: 'test-code', state: returnedState })
    const { container } = await renderHome(session)

    expect(screen.getByRole('status').textContent).toBe("We couldn't reach Spotify to finish signing in.")
    await expectNoAxeViolations(container)

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(redirect).toHaveBeenCalledTimes(1)
  })
})

describe('home page, account not on the allowlist', () => {
  it('explains the Development Mode limit, offers the demo, and signs out', async () => {
    const user = userEvent.setup()
    server.use(profileForbidden())
    const { session, returnedState } = await returnFromSpotify()
    await session.completeSignIn({ code: 'test-code', state: returnedState })
    const { container } = await renderHome(session)

    expect(screen.getByRole('heading', { level: 2, name: "This Spotify account can't sign in yet" })).toBeDefined()
    expect(screen.getByText(/only lets up to five invited accounts sign in/)).toBeDefined()
    expect(screen.getByRole('link', { name: 'Try the demo' }).getAttribute('href')).toBe('/demo')
    expect(screen.queryByRole('button', { name: 'Connect Spotify' })).toBeNull()
    await expectNoAxeViolations(container)

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(session.getState()).toEqual({ status: 'signedOut' })
    expect(screen.getByRole('button', { name: 'Connect Spotify' })).toBeDefined()
  })
})

describe('home page, signed in', () => {
  it('shows who is connected and signs out, clearing stored tokens', async () => {
    const user = userEvent.setup()
    const localStorage = signedInStorage()
    const { session } = createTestSession({ localStorage })
    const { container } = await renderHome(session)

    expect(screen.getByText('Connected as Stored Listener')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Connect Spotify' })).toBeNull()
    await expectNoAxeViolations(container)

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(screen.getByRole('button', { name: 'Connect Spotify' })).toBeDefined()
    expect(localStorage.entries()).toEqual({})
  })
})
