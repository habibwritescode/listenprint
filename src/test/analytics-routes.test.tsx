// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createTestSession, signedInStorage } from './auth-session.ts'
import { expectNoAxeViolations } from './axe.ts'
import { spotifyLibrary, storeWithLibrary } from './library-session.ts'
import { setupSpotifyMocks } from './msw-server.ts'
import { renderApp } from './render-app.ts'

setupSpotifyMocks()

beforeAll(async () => {
  await Promise.all([
    import('../routes/DemoGenresPage.tsx'),
    import('../routes/DemoTimelinePage.tsx'),
    import('../routes/GenresPage.tsx'),
    import('../routes/TimelinePage.tsx'),
  ])
})

afterEach(cleanup)

function signedIn() {
  return createTestSession({ localStorage: signedInStorage() }).session
}

function chart(name: string) {
  return screen.findByRole('list', { name })
}

describe('/demo/timeline', () => {
  // Axe runs on the yearly chart below: the same markup with eight bars instead of ninety, which keeps this suite quick.
  it('counts the sample library by month, with the stats above the chart', async () => {
    renderApp('/demo/timeline')

    expect(await screen.findByRole('heading', { level: 1, name: 'Library timeline' })).toBeDefined()
    const bars = within(await chart('Liked songs by month')).getAllByRole('button')
    expect(bars.length).toBeGreaterThan(12)
    expect(bars[0].getAttribute('aria-label')).toMatch(/^\w+ \d{4}, .* songs? saved, \d+% of \d{4}$/)
    expect(screen.getByText('Busiest month')).toBeDefined()
    expect(screen.getByText('Last 12 months')).toBeDefined()
  })

  it('switches to years through the URL, from the header toggle', async () => {
    const user = userEvent.setup()
    const { router, container } = renderApp('/demo/timeline')
    await chart('Liked songs by month')

    await user.click(screen.getByRole('radio', { name: 'Yearly' }))

    await waitFor(() => expect(router.state.location.searchStr).toBe('?grain=year'))
    const bars = within(await chart('Liked songs by year')).getAllByRole('button')
    expect(bars[0].getAttribute('aria-label')).toMatch(/^\d{4}, .* songs saved, \d+% of the library$/)
    await expectNoAxeViolations(container)
  })

  it('keeps the grain out of the URL at its default', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/demo/timeline?grain=year')
    await chart('Liked songs by year')

    await user.click(screen.getByRole('radio', { name: 'Monthly' }))

    await waitFor(() => expect(router.state.location.searchStr).toBe(''))
  })

  // Four bars stretched across a chart would imply a trend; the page says so instead.
  it('says when there is less than a year to read', async () => {
    const library = spotifyLibrary(6)
    const tracks = library.tracks.map((track, index) => ({
      ...track,
      addedAt: `2026-0${(index % 3) + 1}-05T00:00:00.000Z`,
    }))
    renderApp('/timeline', { auth: signedIn(), store: await storeWithLibrary({ ...library, tracks }) })

    expect(await screen.findByRole('heading', { name: 'Not enough history to read a trend yet' })).toBeDefined()
    expect(screen.queryByText('Busiest month')).toBeNull()
    expect(screen.getByRole('link', { name: 'See the sample timeline' })).toBeDefined()
  })
})

describe('/demo/genres', () => {
  it('ranks the sample library’s genres by tagged songs', async () => {
    const { container } = renderApp('/demo/genres')

    expect(await screen.findByRole('heading', { level: 1, name: 'Genre breakdown' })).toBeDefined()
    const bars = within(await chart('Top genres')).getAllByRole('button')
    expect(bars).toHaveLength(8)
    expect(bars[0].getAttribute('aria-label')).toMatch(/^.+, [\d,]+ songs, \d+\.\d% of tagged songs, [\d,]+ artists$/)
    await expectNoAxeViolations(container)
  })

  it('follows the ranking mode from the header', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/demo/genres')
    const before = within(await chart('Top genres'))
      .getAllByRole('button')
      .map((bar) => bar.getAttribute('aria-label'))

    await user.click(screen.getByRole('radio', { name: 'Primary artist only' }))

    await waitFor(() => expect(router.state.location.searchStr).toBe('?mode=primary'))
    const after = within(await chart('Top genres'))
      .getAllByRole('button')
      .map((bar) => bar.getAttribute('aria-label'))
    expect(after).not.toEqual(before)
  })
})

describe('live chart pages', () => {
  it('explains that the views need a signed-in library', async () => {
    const { container } = renderApp('/genres')

    expect(await screen.findByRole('heading', { level: 1, name: 'This page needs your Spotify library.' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Open the demo' })).toBeDefined()
    await expectNoAxeViolations(container)
  })

  it('offers a scan when nothing is saved yet', async () => {
    const { container } = renderApp('/genres', { auth: signedIn() })

    expect(await screen.findByRole('heading', { level: 1, name: 'There’s no library to break down yet.' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Scan my library' })).toBeDefined()
    await expectNoAxeViolations(container)
  })

  it('names the timeline’s own empty state', async () => {
    renderApp('/timeline', { auth: signedIn() })

    expect(await screen.findByRole('heading', { level: 1, name: 'There’s no library to chart yet.' })).toBeDefined()
  })

  // Only the top 50 artists are looked up, and Spotify returns tags for few of them.
  it('refuses a genre chart the library can’t support, with the real counts', async () => {
    const { container } = renderApp('/genres', { auth: signedIn(), store: await storeWithLibrary() })

    expect(await screen.findByRole('heading', { name: 'Genre data unavailable' })).toBeDefined()
    expect(screen.getByText(/came back empty for \d+ of \d+ songs/)).toBeDefined()
    expect(screen.getByRole('link', { name: 'View timeline instead' })).toBeDefined()
    await expectNoAxeViolations(container)
  })
})

describe('the library nav', () => {
  it('moves between the three views, keeping the ranking mode', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/demo?mode=primary')
    const nav = within(await screen.findByRole('navigation', { name: 'Library views' }))
    expect(nav.getByRole('link', { name: 'Artists' }).getAttribute('aria-current')).toBe('page')

    await user.click(nav.getByRole('link', { name: 'Timeline' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/demo/timeline'))
    expect(router.state.location.searchStr).toBe('?mode=primary')
    expect(nav.getByRole('link', { name: 'Timeline' }).getAttribute('aria-current')).toBe('page')
    expect(nav.getByRole('link', { name: 'Artists' }).getAttribute('aria-current')).toBeNull()
  })

  it('stays away until there is a library to look at', async () => {
    renderApp('/')
    await screen.findByRole('heading', { level: 1 })

    expect(screen.queryByRole('navigation', { name: 'Library views' })).toBeNull()
  })

  it('appears on the live pages once a library is saved', async () => {
    renderApp('/', { auth: signedIn(), store: await storeWithLibrary() })

    await screen.findByRole('list', { name: 'Artists ranked by liked songs' })
    const nav = within(screen.getByRole('navigation', { name: 'Library views' }))
    expect(nav.getByRole('link', { name: 'Genres' }).getAttribute('href')).toBe('/genres')
  })
})
