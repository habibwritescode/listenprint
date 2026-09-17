// @vitest-environment jsdom
// @vitest-environment-options {"url": "http://127.0.0.1:5173/"}
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { SPOTIFY_TOKEN_URL } from '../auth/config.ts'
import type { AuthSession } from '../auth/session.ts'
import { primaryActionClass } from '../components/action-styles.ts'
import { NOW, createTestSession, returnFromSpotify, signedInStorage } from './auth-session.ts'
import { expectNoAxeViolations } from './axe.ts'
import { createMemoryStorage } from './memory-storage.ts'
import type { MemoryStorage } from './memory-storage.ts'
import { server, setupSpotifyMocks } from './msw-server.ts'
import { renderApp } from './render-app.ts'
import { profileForbidden, spotifyNetworkError, tokenRejects } from './spotify-handlers.ts'

setupSpotifyMocks()

// The signed-in home is a lazy component; loaded before any test so a cold import can't miss findBy's timeout.
beforeAll(async () => {
  await import('../components/library/SignedInHome.tsx')
})

afterEach(cleanup)

const SIGNED_OUT_TITLE = 'See which artists actually own your library.'

async function renderHome(auth: AuthSession, title = SIGNED_OUT_TITLE) {
  const view = renderApp('/', { auth })
  await screen.findByRole('heading', { level: 1, name: title })
  return view
}

function kicker(text: string) {
  return screen.getByText(text).dataset.tone
}

describe('home page, signed out', () => {
  it('connects to Spotify, and shows the button as busy while leaving', async () => {
    const user = userEvent.setup()
    const { session, redirect } = createTestSession()
    await renderHome(session)

    await user.click(screen.getByRole('button', { name: 'Connect Spotify' }))

    // The redirect follows an async code-challenge hash, which can lag under a busy test run.
    await waitFor(() => expect(redirect).toHaveBeenCalledTimes(1))
    const url = new URL(redirect.mock.calls[0][0])
    expect(`${url.origin}${url.pathname}`).toBe('https://accounts.spotify.com/authorize')
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Opening Spotify…' }).disabled).toBe(true)
    // A slow redirect must not trap anyone.
    expect(screen.getByRole('link', { name: 'Try the demo' }).getAttribute('href')).toBe('/demo')
  })

  it('introduces the app in its own voice, states the invite limit, and offers the demo', async () => {
    const { container } = await renderHome(createTestSession().session)

    expect(kicker('Client-side Spotify analytics')).toBe('product')
    expect(screen.getByText(/limited to five invited accounts/)).toBeDefined()
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
    const { container } = await renderHome(session)

    await user.click(screen.getByRole('button', { name: 'Connect Spotify' }))

    await screen.findByRole('heading', { level: 1, name: 'This browser is blocking site storage.' })
    expect(kicker('Browser setting')).toBe('attention')
    expect(screen.getByRole('link', { name: 'Try the demo' }).getAttribute('href')).toBe('/demo')
    expect(redirect).not.toHaveBeenCalled()
    await expectNoAxeViolations(container)

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(redirect).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { level: 1, name: 'This browser is blocking site storage.' })).toBeDefined()
  })
})

describe('home page notices', () => {
  it.each([
    {
      notice: 'cancelled',
      setUp: async () => {
        const { session, redirect } = createTestSession()
        await session.completeSignIn({ error: 'access_denied' })
        return { session, redirect }
      },
      kickerText: 'Sign-in stopped',
      tone: 'neutral',
      title: 'You cancelled the Spotify sign-in.',
      action: 'Connect Spotify',
    },
    {
      notice: 'unverified',
      setUp: async () => {
        const { session, redirect } = createTestSession()
        await session.completeSignIn({ code: 'test-code', state: 'unknown-state' })
        return { session, redirect }
      },
      kickerText: 'Verification failed',
      tone: 'attention',
      title: 'That sign-in couldn’t be verified.',
      action: 'Start sign-in again',
    },
    {
      notice: 'expired',
      setUp: async () => {
        server.use(tokenRejects('invalid_grant'))
        const { session, redirect } = createTestSession({ localStorage: signedInStorage({ expiresAt: NOW }) })
        await session.getAccessToken().catch(() => {})
        return { session, redirect }
      },
      kickerText: 'Session ended',
      tone: 'neutral',
      title: 'Your Spotify session ended.',
      action: 'Reconnect Spotify',
    },
  ])('shows the $notice notice with a way to sign in again', async ({ setUp, kickerText, tone, title, action }) => {
    const user = userEvent.setup()
    const { session, redirect } = await setUp()
    const { container } = await renderHome(session, title)

    expect(kicker(kickerText)).toBe(tone)
    expect(screen.getByRole('link', { name: 'Try the demo' }).getAttribute('href')).toBe('/demo')
    await expectNoAxeViolations(container)

    await user.click(screen.getByRole('button', { name: action }))

    // The redirect follows an async code-challenge hash, which can lag under a busy test run.
    await waitFor(() => expect(redirect).toHaveBeenCalledTimes(1))
    // Only the pressed button changes: swapping screens mid-redirect would read as a glitch.
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeDefined()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Opening Spotify…' }).disabled).toBe(true)
  })

  it('offers to try again when Spotify could not be reached to finish signing in', async () => {
    const user = userEvent.setup()
    server.use(spotifyNetworkError(SPOTIFY_TOKEN_URL))
    const { session, redirect, returnedState } = await returnFromSpotify()
    await session.completeSignIn({ code: 'test-code', state: returnedState })
    const { container } = await renderHome(session, 'Couldn’t reach Spotify.')

    expect(kicker('Network')).toBe('attention')
    await expectNoAxeViolations(container)

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    // The redirect follows an async code-challenge hash, which can lag under a busy test run.
    await waitFor(() => expect(redirect).toHaveBeenCalledTimes(1))
  })
})

describe('home page, account not on the allowlist', () => {
  it('explains the Development Mode limit, offers the demo first, and signs out', async () => {
    const user = userEvent.setup()
    server.use(profileForbidden())
    const { session, returnedState } = await returnFromSpotify()
    await session.completeSignIn({ code: 'test-code', state: returnedState })
    const { container } = await renderHome(session, 'This Spotify account can’t sign in yet.')

    expect(kicker('Development mode')).toBe('attention')
    expect(screen.getByText(/allows exactly five invited accounts/)).toBeDefined()
    const demo = screen.getByRole('link', { name: 'Explore the demo' })
    expect(demo.getAttribute('href')).toBe('/demo')
    expect(demo.className).toBe(primaryActionClass)
    expect(screen.queryByRole('button', { name: 'Connect Spotify' })).toBeNull()
    await expectNoAxeViolations(container)

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(session.getState()).toEqual({ status: 'signedOut' })
    expect(await screen.findByRole('heading', { level: 1, name: SIGNED_OUT_TITLE })).toBeDefined()
  })
})

describe('home page, signed in', () => {
  it('shows who is connected in the header and the page, and signs out, clearing stored tokens', async () => {
    const user = userEvent.setup()
    const localStorage = signedInStorage()
    const { session } = createTestSession({ localStorage })
    const { container } = await renderHome(session, 'Connected as Stored Listener.')

    expect(kicker('Ready')).toBe('neutral')
    const header = screen.getByRole('banner')
    expect(within(header).getByText('Stored Listener')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Try the demo' }).getAttribute('href')).toBe('/demo')
    expect(screen.queryByRole('button', { name: 'Connect Spotify' })).toBeNull()
    await expectNoAxeViolations(container)

    await user.click(within(header).getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { level: 1, name: SIGNED_OUT_TITLE })).toBeDefined()
    expect(within(screen.getByRole('banner')).queryByRole('button', { name: 'Sign out' })).toBeNull()
    expect(localStorage.entries()).toEqual({})
  })

  it('keeps the connected identity off the demo pages', async () => {
    const { session } = createTestSession({ localStorage: signedInStorage() })
    renderApp('/demo', { auth: session })

    await screen.findByRole('list', { name: 'Artists ranked by liked songs' })
    expect(screen.queryByText('Stored Listener')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
  })
})
