// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { SPOTIFY_API_URL } from '../auth/config.ts'
import { createMemoryLibraryStore } from '../spotify/library-store.ts'
import { spotifyLibrary, storeWithLibrary } from './library-session.ts'
import { createTestSession, signedInStorage } from './auth-session.ts'
import { expectNoAxeViolations } from './axe.ts'
import { makeArtist, makeTrack } from './factories.ts'
import { recordRequests, server, setupSpotifyMocks } from './msw-server.ts'
import { renderApp } from './render-app.ts'
import { SAVED_TRACKS_URL, artistResponds, savedTrackItems } from './spotify-library-handlers.ts'

setupSpotifyMocks()

// Lazy route pieces load before any test, so a cold import can't miss findBy's timeout.
beforeAll(async () => {
  await Promise.all([
    import('../components/library/SignedInHome.tsx'),
    import('../components/library/LiveLibrary.tsx'),
    import('../components/library/LiveArtist.tsx'),
    import('../routes/ArtistPage.tsx'),
  ])
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

const scannedAt = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'UTC',
}).format(new Date('2026-09-10T08:00:00.000Z'))

describe('home page, with a saved library', () => {
  it('shows the live ranking with photos, without asking Spotify for anything', async () => {
    const store = await storeWithLibrary()
    await store.saveArtistDetails('saved-artist-0', {
      details: { id: 'saved-artist-0', imageUrl: 'https://i.scdn.co/image/s0', genres: [] },
      fetchedAt: Date.UTC(2026, 8, 10),
    })
    const requests = recordRequests()
    const { container } = renderApp('/', { auth: signedIn(), store })

    const list = await screen.findByRole('list', { name: 'Artists ranked by liked songs' })
    expect(screen.getByText(`Scanned ${scannedAt} UTC`)).toBeDefined()
    expect(screen.getByText('1 tie in your top 100')).toBeDefined()
    expect(screen.getByRole('heading', { level: 2, name: '3 artists' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDefined()
    const rows = within(list).getAllByRole('listitem')
    const photographed = rows.find((row) => row.querySelector('img'))
    expect(photographed?.querySelector('img')?.getAttribute('src')).toBe('https://i.scdn.co/image/s0')
    expect(within(rows[0]).getByRole('link').getAttribute('href')).toMatch(/^\/artist\/saved-artist-/)
    expect(screen.queryByText(/won’t be kept/)).toBeNull()
    await expectNoAxeViolations(container)
    expect(spotifyRequests(requests)).toHaveLength(0)
  })

  // Only the top 50 artists get a photo lookup; everyone else shows album art from their liked tracks, like the old app.
  it('shows album art for artists without a fetched photo', async () => {
    const library = spotifyLibrary()
    const tracks = library.tracks.map((track) =>
      track.artists[0].id === 'saved-artist-1' ? { ...track, albumImageUrl: 'https://i.scdn.co/image/album-1' } : track,
    )
    const store = await storeWithLibrary({ ...library, tracks })
    await store.saveArtistDetails('saved-artist-0', {
      details: { id: 'saved-artist-0', imageUrl: 'https://i.scdn.co/image/photo-0', genres: [] },
      fetchedAt: Date.UTC(2026, 8, 10),
    })
    renderApp('/', { auth: signedIn(), store })

    const list = await screen.findByRole('list', { name: 'Artists ranked by liked songs' })
    const imageFor = (name: string) =>
      within(list).getByRole('link', { name }).closest('li')?.querySelector('img')?.getAttribute('src') ?? null
    await waitFor(() => expect(imageFor('Saved Artist 0')).toBe('https://i.scdn.co/image/photo-0'))
    expect(imageFor('Saved Artist 1')).toBe('https://i.scdn.co/image/album-1')
    expect(imageFor('Saved Artist 2')).toBeNull()
  })

  it('puts the mode pills in the header, and keeps mode and sort in the URL', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/?sort=alpha', { auth: signedIn(), store: await storeWithLibrary() })

    const header = within(await screen.findByTestId('site-header'))
    await user.click(await header.findByRole('radio', { name: 'Primary artist only' }))

    await waitFor(() => expect(router.state.location.search).toEqual({ mode: 'primary', sort: 'alpha' }))
    expect(router.state.location.pathname).toBe('/')
    expect(screen.getByRole('heading', { level: 2, name: '3 artists, A to Z' })).toBeDefined()
  })

  it('keeps the previous ranking on screen while refreshing, then swaps in the new one', async () => {
    const user = userEvent.setup()
    const { handler, release } = pausingLibrary()
    server.use(handler, artistResponds({}))
    const { container } = renderApp('/', { auth: signedIn(), store: await storeWithLibrary() })
    await user.click(await screen.findByRole('button', { name: 'Refresh' }))

    await screen.findByText('Read 50 of 120 liked songs…')
    await expectNoAxeViolations(container)
    expect(screen.getByRole('list', { name: 'Artists ranked by liked songs' })).toBeDefined()
    expect(screen.getByRole('heading', { level: 2, name: '3 artists · from your last scan' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull()
    expect(screen.getByTestId('site-header').querySelector('[data-stale]')).not.toBeNull()

    release()

    expect(await screen.findByRole('heading', { level: 2, name: '5 artists' })).toBeDefined()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.getByTestId('site-header').querySelector('[data-stale]')).toBeNull()
  })

  it('goes back to the previous ranking when a refresh is cancelled', async () => {
    const user = userEvent.setup()
    const { handler, release } = pausingLibrary()
    server.use(handler, artistResponds({}))
    renderApp('/', { auth: signedIn(), store: await storeWithLibrary() })
    await user.click(await screen.findByRole('button', { name: 'Refresh' }))
    await screen.findByText('Read 50 of 120 liked songs…')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    release()

    expect(await screen.findByRole('button', { name: 'Refresh' })).toBeDefined()
    expect(screen.getByRole('heading', { level: 2, name: '3 artists' })).toBeDefined()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('explains an empty library and offers a refresh or the demo', async () => {
    const empty = { ...spotifyLibrary(0), tracks: [] }
    const { container } = renderApp('/', { auth: signedIn(), store: await storeWithLibrary(empty) })

    expect(await screen.findByText('No liked songs to rank')).toBeDefined()
    expect(screen.getByText(/Like a few songs, then refresh/)).toBeDefined()
    expect(screen.getAllByRole('button', { name: 'Refresh' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'See the demo' }).getAttribute('href')).toBe('/demo')
    expect(screen.getByText('Saved tracks', { selector: 'dt' }).nextElementSibling?.textContent).toBe('0')
    await expectNoAxeViolations(container)
  })

  it('says when this browser won’t keep the library', async () => {
    const store = await storeWithLibrary(spotifyLibrary(), { persistent: false })

    renderApp('/', { auth: signedIn(), store })

    expect(await screen.findByText(/won’t be kept after this tab closes/)).toBeDefined()
  })
})

describe('live artist page', () => {
  // Only the top 50 are looked up, so a missing artist is not the same as one Spotify has no tags for.
  it('tells apart an artist with no tags from one that was never looked up', async () => {
    const store = await storeWithLibrary()
    await store.saveArtistDetails('saved-artist-0', {
      details: { id: 'saved-artist-0', imageUrl: null, genres: ['dream pop'] },
      fetchedAt: Date.UTC(2026, 8, 10),
    })
    await store.saveArtistDetails('saved-artist-1', {
      details: { id: 'saved-artist-1', imageUrl: null, genres: [] },
      fetchedAt: Date.UTC(2026, 8, 10),
    })
    const { unmount } = renderApp('/artist/saved-artist-0', { auth: signedIn(), store })
    expect(await screen.findByText('dream pop')).toBeDefined()
    unmount()

    renderApp('/artist/saved-artist-1', { auth: signedIn(), store })
    expect(await screen.findByText('No genre tags — Spotify doesn’t provide any for this artist')).toBeDefined()
    cleanup()

    renderApp('/artist/saved-artist-2', { auth: signedIn(), store })
    expect(await screen.findByText('Genres are looked up for your top 50 artists')).toBeDefined()
  })

  it('shows the artist from the saved library, with Spotify links, albums and a photo', async () => {
    const store = await storeWithLibrary()
    await store.saveArtistDetails('saved-artist-0', {
      details: { id: 'saved-artist-0', imageUrl: 'https://i.scdn.co/image/s0', genres: [] },
      fetchedAt: Date.UTC(2026, 8, 10),
    })
    const requests = recordRequests()
    const { container } = renderApp('/artist/saved-artist-0?mode=primary&sort=alpha', { auth: signedIn(), store })

    expect(await screen.findByRole('heading', { level: 1, name: 'Saved Artist 0' })).toBeDefined()
    expect(screen.getByText('Tied 1st of 3')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Open in Spotify' }).getAttribute('href')).toBe(
      'https://open.spotify.com/artist/saved-artist-0',
    )
    const tracks = screen.getByRole('list', { name: 'Liked songs by Saved Artist 0' })
    const trackLinks = within(tracks).getAllByRole('link', { name: /in Spotify — opens in a new tab$/ })
    expect(trackLinks.length).toBeGreaterThan(0)
    expect(container.querySelector('[data-slot="track-columns"]')?.textContent).toContain('Album')
    expect(container.querySelector('header img, section img')?.getAttribute('src')).toBe('https://i.scdn.co/image/s0')
    const back = within(screen.getByTestId('site-header')).getByRole('link', { name: 'Back to ranking' })
    expect(back.getAttribute('href')).toBe('/?mode=primary&sort=alpha')
    await expectNoAxeViolations(container)
    expect(spotifyRequests(requests)).toHaveLength(0)
  })

  it('uses album art for the header when the artist has no fetched photo', async () => {
    const library = spotifyLibrary()
    const tracks = library.tracks.map((track) => ({ ...track, albumImageUrl: 'https://i.scdn.co/image/album' }))
    renderApp('/artist/saved-artist-2', { auth: signedIn(), store: await storeWithLibrary({ ...library, tracks }) })

    await screen.findByRole('heading', { level: 1, name: 'Saved Artist 2' })
    await waitFor(() =>
      expect(document.querySelector('main header img')?.getAttribute('src')).toBe('https://i.scdn.co/image/album'),
    )
  })

  it('explains that artist pages need a signed-in library', async () => {
    const { container } = renderApp('/artist/saved-artist-0')

    const title = 'This page needs your Spotify library.'
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeDefined()
    const home = within(screen.getByRole('main')).getByRole('link', { name: 'Go to the home page' })
    expect(home.getAttribute('href')).toBe('/')
    expect(screen.getByRole('link', { name: 'Open the demo' }).getAttribute('href')).toBe('/demo')
    await expectNoAxeViolations(container)
  })

  it('offers a scan when nothing is saved yet, and shows its progress on the home page', async () => {
    const user = userEvent.setup()
    const { handler, release } = pausingLibrary()
    server.use(handler, artistResponds({}))
    const { router, container } = renderApp('/artist/saved-artist-0', { auth: signedIn() })

    expect(await screen.findByRole('heading', { level: 1, name: 'Your library isn’t loaded yet.' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'See the sample library' }).getAttribute('href')).toBe('/demo')
    await expectNoAxeViolations(container)

    await user.click(screen.getByRole('button', { name: 'Scan my library' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(await screen.findByText('Read 50 of 120 liked songs…')).toBeDefined()
    release()
  })

  // Distinct from a 404: the route exists, but the id isn't in this library, such as a link from someone else's.
  it('says when the artist is not in the saved library', async () => {
    const { container } = renderApp('/artist/someone-elses-artist?mode=primary', {
      auth: signedIn(),
      store: await storeWithLibrary(),
    })

    expect(await screen.findByRole('heading', { level: 1, name: 'That artist isn’t in your library.' })).toBeDefined()
    expect(screen.getByText('/artist/someone-elses-artist')).toBeDefined()
    const back = within(screen.getByRole('main')).getByRole('link', { name: 'Back to ranking' })
    expect(back.getAttribute('href')).toBe('/?mode=primary')
    await expectNoAxeViolations(container)
  })
})
