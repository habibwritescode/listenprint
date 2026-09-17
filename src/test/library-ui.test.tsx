// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { SPOTIFY_API_URL } from '../auth/config.ts'
import { createMemoryLibraryStore } from '../spotify/library-store.ts'
import { createTestSession, signedInStorage } from './auth-session.ts'
import { expectNoAxeViolations } from './axe.ts'
import { makeArtist, makeTrack } from './factories.ts'
import { recordRequests, server, setupSpotifyMocks } from './msw-server.ts'
import { renderApp } from './render-app.ts'
import { SAVED_TRACKS_URL, artistResponds, savedTrackItems } from './spotify-library-handlers.ts'

setupSpotifyMocks()

// Lazy route pieces load before any test, so a cold import can't miss findBy's timeout.
beforeAll(async () => {
  await Promise.all([import('../components/library/SignedInHome.tsx'), import('../components/library/LiveLibrary.tsx')])
})

afterEach(cleanup)

function signedIn() {
  return createTestSession({ localStorage: signedInStorage() }).session
}

/** Pages of 120 liked songs; the page at `pauseAt` waits until `release()` is called. */
function pausingLibrary(pauseAt = 50) {
  const items = savedTrackItems(120)
  let release = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  const handler = http.get(SAVED_TRACKS_URL, async ({ request }) => {
    const offset = Number(new URL(request.url).searchParams.get('offset'))
    if (offset === pauseAt) await released
    return HttpResponse.json({ items: items.slice(offset, offset + 50), total: items.length })
  })
  return { handler, release }
}

function spotifyRequests(requests: { url: string }[]) {
  return requests.filter((request) => request.url.startsWith(SPOTIFY_API_URL))
}

describe('home page, signed in with no saved library', () => {
  it('invites a scan, states its cost and where the library is kept, and requests nothing yet', async () => {
    const requests = recordRequests()
    const { container } = renderApp('/', { auth: signedIn() })

    expect(await screen.findByRole('heading', { level: 1, name: 'Connected as Stored Listener.' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Scan my library' })).toBeDefined()
    expect(screen.getByText(/saves them in this browser/)).toBeDefined()
    expect(screen.getByText(/About 40 seconds for a 10,000-track library/i)).toBeDefined()
    expect(container.querySelectorAll('[data-slot="skeleton-row"]').length).toBeGreaterThan(0)
    await expectNoAxeViolations(container)
    expect(spotifyRequests(requests)).toHaveLength(0)
  })
})

describe('home page, scanning', () => {
  it('shows progress in tracks with placeholder stats and rows, then the ranking', async () => {
    const user = userEvent.setup()
    const { handler, release } = pausingLibrary()
    server.use(handler, artistResponds({}))
    const { container } = renderApp('/', { auth: signedIn() })

    await user.click(await screen.findByRole('button', { name: 'Scan my library' }))

    const progress = await screen.findByRole('progressbar', { name: 'Reading liked songs' })
    await waitFor(() => expect(progress.getAttribute('aria-valuenow')).toBe('50'))
    expect(progress.getAttribute('aria-valuemax')).toBe('120')
    expect(screen.getByText('Read 50 of 120 liked songs…')).toBeDefined()
    const concentration = screen.getByText('Concentration', { selector: 'dt' }).nextElementSibling
    expect(concentration?.textContent).toBe('—')
    expect(screen.getByText('Saved tracks', { selector: 'dt' }).nextElementSibling?.textContent).toBe('—')
    expect(screen.getByRole('heading', { level: 2, name: 'Building your ranking' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined()
    await expectNoAxeViolations(container)

    release()

    expect(await screen.findByRole('list', { name: 'Artists ranked by liked songs' })).toBeDefined()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('stops after the page in flight when cancelled, then resumes from there', async () => {
    const user = userEvent.setup()
    const { handler, release } = pausingLibrary()
    server.use(handler, artistResponds({}))
    const requests = recordRequests()
    renderApp('/', { auth: signedIn() })
    await user.click(await screen.findByRole('button', { name: 'Scan my library' }))
    await screen.findByText('Read 50 of 120 liked songs…')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    release()

    // Cancel takes effect after the page already on its way, so that page is kept.
    expect(await screen.findByText('You stopped the scan at 100 of 120 liked songs.')).toBeDefined()

    await user.click(screen.getByRole('button', { name: 'Resume' }))

    expect(await screen.findByRole('list', { name: 'Artists ranked by liked songs' })).toBeDefined()
    const offsets = requests
      .filter((request) => request.url.startsWith(SAVED_TRACKS_URL))
      .map((request) => new URL(request.url).searchParams.get('offset'))
    expect(offsets).toEqual(['0', '50', '100'])
  })

  it('explains an interruption and offers to resume or start over', async () => {
    const user = userEvent.setup()
    const items = savedTrackItems(120)
    let failing = true
    server.use(
      http.get(SAVED_TRACKS_URL, ({ request }) => {
        const offset = Number(new URL(request.url).searchParams.get('offset'))
        if (failing && offset === 50) return new HttpResponse(null, { status: 403 })
        return HttpResponse.json({ items: items.slice(offset, offset + 50), total: items.length })
      }),
      artistResponds({}),
    )
    const { container } = renderApp('/', { auth: signedIn() })
    await user.click(await screen.findByRole('button', { name: 'Scan my library' }))

    const status = await screen.findByRole('status', { name: 'Scan stopped' })
    expect(within(status).getByText(/Spotify refused access to your library at 50 of 120 liked songs/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Start over' })).toBeDefined()
    await expectNoAxeViolations(container)

    failing = false
    await user.click(screen.getByRole('button', { name: 'Resume' }))

    expect(await screen.findByRole('list', { name: 'Artists ranked by liked songs' })).toBeDefined()
  })

  it('offers to resume a scan an earlier visit left unfinished', async () => {
    const store = createMemoryLibraryStore()
    await store.savePartialScan({
      tracks: [makeTrack({ artists: [makeArtist()] })],
      nextOffset: 50,
      total: 90,
      startedAt: '2026-09-16T10:00:00.000Z',
    })

    renderApp('/', { auth: signedIn(), store })

    expect(await screen.findByText('An earlier scan stopped at 1 of 90 liked songs when its tab closed.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Resume' })).toBeDefined()
  })
})
