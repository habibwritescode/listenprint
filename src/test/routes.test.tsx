// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { concentration, ordinal, roundedPercents, sortRankings } from '../library/presentation.ts'
import { rankArtists } from '../library/rankings.ts'
import type { ArtistRanking, RankingMode } from '../library/types.ts'
import type { AppRouter } from '../router.ts'
import { expectNoAxeViolations } from './axe.ts'
import { renderApp, testLibrary } from './render-app.ts'

// The demo pages are lazy route components. Loaded cold while another test file is transforming, the
// first test here once missed findBy's 1s timeout, so the chunks are loaded before any test starts.
beforeAll(async () => {
  await Promise.all([import('../routes/DemoPage.tsx'), import('../routes/DemoArtistPage.tsx')])
})

afterEach(cleanup)

const countFormat = new Intl.NumberFormat()

function demoSearch(router: AppRouter) {
  return router.state.matches.find((match) => match.routeId === '/demo')?.search
}

function firstCatalogArtist() {
  const artist = testLibrary.tracks.flatMap((track) => track.artists).find((a) => !a.id.startsWith('local:'))
  if (!artist) throw new Error('test library has no catalog artist')
  return artist
}

function statValue(label: string) {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent
}

function radio(name: string) {
  return screen.getByRole<HTMLInputElement>('radio', { name })
}

function featuredOnlyArtist() {
  const primaryIds = new Set(rankArtists(testLibrary.tracks, 'primary').map((ranking) => ranking.artist.id))
  const ranking = rankArtists(testLibrary.tracks, 'all').find((candidate) => !primaryIds.has(candidate.artist.id))
  if (!ranking) throw new Error('test library has no featured-only artist')
  return ranking
}

function sampleKicker(ranking: ArtistRanking, mode: RankingMode) {
  const rankings = rankArtists(testLibrary.tracks, mode)
  const tied = rankings.filter((candidate) => candidate.rank === ranking.rank).length > 1
  const place = `${tied ? 'Tied' : 'Ranked'} ${ordinal(ranking.rank)}`
  return `Sample library · ${place} of ${countFormat.format(rankings.length)}`
}

function topRowName(mode: RankingMode) {
  const [top] = rankArtists(testLibrary.tracks, mode)
  const name = top.artist.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^Rank 1, (tied, )?${name}, ${top.count} liked songs?, `)
}

describe('/demo search params', () => {
  it('resolves ?mode=primary and keeps it in the URL', async () => {
    const { router } = renderApp('/demo?mode=primary')

    await screen.findByRole('heading', { level: 1, name: 'Sample library ranking' })

    expect(demoSearch(router)).toEqual({ mode: 'primary', sort: 'count' })
    expect(router.state.location.searchStr).toBe('?mode=primary')
  })

  it.each(['/demo?mode=bogus', '/demo?mode=all', '/demo'])(
    'resolves %s to all mode with no mode left in the URL',
    async (url) => {
      const { router } = renderApp(url)

      await screen.findByRole('heading', { level: 1, name: 'Sample library ranking' })

      expect(demoSearch(router)).toEqual({ mode: 'all', sort: 'count' })
      expect(router.state.location.searchStr).toBe('')
    },
  )
})

describe('live route search params', () => {
  it.each([
    ['/?mode=primary&sort=alpha', '/', { mode: 'primary', sort: 'alpha' }, '?mode=primary&sort=alpha'],
    ['/?mode=bogus&sort=count', '/', { mode: 'all', sort: 'count' }, ''],
    ['/artist/abc123?mode=primary', '/artist/$artistId', { mode: 'primary', sort: 'count' }, '?mode=primary'],
  ] as const)('resolves %s like the demo routes', async (url, routeId, search, searchStr) => {
    const { router } = renderApp(url)

    await waitFor(() => expect(router.state.status).toBe('idle'))

    expect(router.state.matches.find((match) => match.routeId === routeId)?.search).toEqual(search)
    expect(router.state.location.searchStr).toBe(searchStr)
  })
})

describe('/demo sort', () => {
  function firstAlphaRowName() {
    const [first] = sortRankings(rankArtists(testLibrary.tracks, 'all'), 'alpha')
    const name = first.artist.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`^Rank ${first.rank}, ${name}, `)
  }

  it('orders rows by name for ?sort=alpha, keeping count ranks', async () => {
    const { router } = renderApp('/demo?sort=alpha')

    const list = await screen.findByRole('list', { name: 'Artists ranked by liked songs' })
    const rows = within(list).getAllByRole('listitem')
    expect(within(rows[0]).getByRole('link').getAttribute('aria-label')).toMatch(firstAlphaRowName())
    expect(demoSearch(router)).toEqual({ mode: 'all', sort: 'alpha' })
    expect(router.state.location.searchStr).toBe('?sort=alpha')
    const artistCount = countFormat.format(rankArtists(testLibrary.tracks, 'all').length)
    expect(screen.getByRole('heading', { level: 2, name: `${artistCount} artists, A to Z` })).toBeDefined()
  })

  it.each(['/demo?sort=bogus', '/demo?sort=count'])('resolves %s to count order, sort-free URL', async (url) => {
    const { router } = renderApp(url)

    await screen.findByRole('link', { name: topRowName('all') })

    expect(demoSearch(router)).toEqual({ mode: 'all', sort: 'count' })
    expect(router.state.location.searchStr).toBe('')
  })

  it('switches sort in the URL without adding history entries, keeping the mode', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/demo?mode=primary')
    await screen.findByRole('radio', { name: 'A to Z' })
    const historyLength = router.history.length

    await user.click(screen.getByRole('radio', { name: 'A to Z' }))
    await waitFor(() => expect(router.state.location.searchStr).toBe('?mode=primary&sort=alpha'))
    await user.click(screen.getByRole('radio', { name: 'Count' }))
    await waitFor(() => expect(router.state.location.searchStr).toBe('?mode=primary'))

    expect(router.history.length).toBe(historyLength)
  })
})

describe('/demo ranking mode', () => {
  it('checks the option that matches the URL', async () => {
    renderApp('/demo?mode=primary')

    await screen.findByRole('radio', { name: 'Primary artist only' })

    expect(radio('Primary artist only').checked).toBe(true)
    expect(radio('All credited artists').checked).toBe(false)
  })

  it('switches mode in the URL without adding history entries', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/demo')
    await screen.findByRole('radio', { name: 'Primary artist only' })
    const historyLength = router.history.length

    await user.click(radio('Primary artist only'))
    await waitFor(() => expect(router.state.location.searchStr).toBe('?mode=primary'))
    await user.click(radio('All credited artists'))
    await waitFor(() => expect(router.state.location.searchStr).toBe(''))

    expect(router.history.length).toBe(historyLength)
  })

  it.each(['all', 'primary'] as const)('shows the stats and top artist for %s mode', async (mode) => {
    const rankings = rankArtists(testLibrary.tracks, mode)

    renderApp(mode === 'all' ? '/demo' : '/demo?mode=primary')

    expect(await screen.findByRole('link', { name: topRowName(mode) })).toBeDefined()
    const tiers = concentration(rankings, testLibrary.tracks.length)
    if (!tiers) throw new Error('test library is empty')
    const [top10, next90] = roundedPercents([tiers.top10Tracks, tiers.next90Tracks, tiers.restTracks])
    expect(statValue('Concentration')).toBe(`${top10}%`)
    expect(statValue('Saved tracks')).toBe(countFormat.format(testLibrary.tracks.length))
    expect(statValue('Artists')).toBe(countFormat.format(rankings.length))
    expect(screen.getByText(`Top 10 · ${top10}%`)).toBeDefined()
    expect(screen.getByText(`Next 90 · ${next90}%`)).toBeDefined()
    const trackTotal = countFormat.format(testLibrary.tracks.length)
    expect(screen.getByText(new RegExp(`Sample library: ${trackTotal} tracks`))).toBeDefined()
  })

  it('updates the stats when the mode changes', async () => {
    const user = userEvent.setup()
    const primaryArtists = rankArtists(testLibrary.tracks, 'primary').length
    const allArtists = rankArtists(testLibrary.tracks, 'all').length
    expect(primaryArtists).not.toBe(allArtists)
    renderApp('/demo')
    await screen.findByRole('radio', { name: 'Primary artist only' })

    await user.click(radio('Primary artist only'))

    await waitFor(() => expect(statValue('Artists')).toBe(countFormat.format(primaryArtists)))
    expect(screen.getByRole('link', { name: topRowName('primary') })).toBeDefined()
  })
})

describe('/demo/artist/$artistId', () => {
  it('renders the page for an artist in the demo library', async () => {
    const artist = firstCatalogArtist()

    renderApp(`/demo/artist/${artist.id}`)

    expect(await screen.findByRole('heading', { level: 1, name: artist.name })).toBeDefined()
  })

  // Distinct from a 404: the route exists, the artist doesn't.
  it('explains when the artist is not in the sample library', async () => {
    const { container } = renderApp('/demo/artist/does-not-exist?mode=primary')

    const title = 'That artist isn’t in the sample library.'
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeDefined()
    expect(screen.getByText('Not in this library').dataset.tone).toBe('neutral')
    expect(screen.getByText('/demo/artist/does-not-exist')).toBeDefined()
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Back to ranking' }).getAttribute('href')).toBe(
      '/demo?mode=primary',
    )
    await expectNoAxeViolations(container)
  })

  it.each(['all', 'primary'] as const)('shows the rank, count, and counted tracks for %s mode', async (mode) => {
    const ranking = rankArtists(testLibrary.tracks, mode)[1]

    renderApp(`/demo/artist/${ranking.artist.id}${mode === 'primary' ? '?mode=primary' : ''}`)

    expect(await screen.findByText(sampleKicker(ranking, mode))).toBeDefined()
    expect(screen.getByText('Sample artist — no Spotify page')).toBeDefined()
    expect(screen.getByText('Saved tracks', { selector: 'dt' }).nextElementSibling?.textContent).toBe(
      countFormat.format(ranking.count),
    )
    const list = screen.getByRole('list', { name: `Liked songs by ${ranking.artist.name}` })
    expect(list.querySelector('li')?.getAttribute('aria-setsize')).toBe(String(ranking.count))
  })

  it('explains that a featured-only artist is not counted in primary mode and switches to all mode', async () => {
    const user = userEvent.setup()
    const ranking = featuredOnlyArtist()
    const { router } = renderApp(`/demo/artist/${ranking.artist.id}?mode=primary`)

    expect(await screen.findByText('Not ranked while counting primary artists only')).toBeDefined()
    const cardTitle = 'Nothing to show in “primary artist only”'
    expect(screen.getByRole('heading', { level: 2, name: cardTitle })).toBeDefined()
    expect(screen.queryByRole('list', { name: /Liked songs by/ })).toBeNull()
    expect(screen.queryByText('Saved tracks', { selector: 'dt' })).toBeNull()

    await user.click(screen.getByRole('link', { name: 'Switch to all artists' }))

    expect(await screen.findByText(sampleKicker(ranking, 'all'))).toBeDefined()
    expect(router.state.location.pathname).toBe(`/demo/artist/${ranking.artist.id}`)
    expect(router.state.location.searchStr).toBe('')
  })
})

describe('list to detail navigation', () => {
  function scrollWindowTo(y: number) {
    Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
    document.dispatchEvent(new Event('scroll'))
  }

  // A new history entry would land at the top of a list that can be thousands of rows long.
  it('goes back through history from "Back to ranking", restoring the list scroll position', async () => {
    const user = userEvent.setup()
    const scrollTo = vi.spyOn(window, 'scrollTo')
    const { router } = renderApp('/demo?mode=primary')
    const list = await screen.findByRole('list', { name: 'Artists ranked by liked songs' })
    scrollWindowTo(3_080)

    await user.click(within(list).getAllByRole('link')[0])
    await screen.findByRole('link', { name: 'Back to ranking' })
    expect(router.history.canGoBack()).toBe(true)
    scrollWindowTo(0)
    scrollTo.mockClear()

    await user.click(screen.getByRole('link', { name: 'Back to ranking' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/demo'))
    expect(router.state.location.searchStr).toBe('?mode=primary')
    expect(router.history.canGoBack()).toBe(false)
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 3_080 })))
    scrollWindowTo(0)
    vi.restoreAllMocks()
  })

  // Opened from a shared link there is no list behind the page to go back to.
  it('opens the ranking as a new page when the artist page was not reached from it', async () => {
    const user = userEvent.setup()
    const [top] = rankArtists(testLibrary.tracks, 'all')
    const { router } = renderApp(`/demo/artist/${top.artist.id}?sort=alpha`)

    await user.click(await screen.findByRole('link', { name: 'Back to ranking' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/demo'))
    expect(router.state.location.searchStr).toBe('?sort=alpha')
    expect(router.history.canGoBack()).toBe(true)
  })

  it('keeps primary mode from the list to the artist page and back', async () => {
    const user = userEvent.setup()
    const [top] = rankArtists(testLibrary.tracks, 'primary')
    const { router } = renderApp('/demo?mode=primary')

    await user.click(await screen.findByRole('link', { name: topRowName('primary') }))

    expect(await screen.findByRole('heading', { level: 1, name: top.artist.name })).toBeDefined()
    expect(screen.getByText(sampleKicker(top, 'primary'))).toBeDefined()
    expect(router.state.location.pathname).toBe(`/demo/artist/${top.artist.id}`)
    expect(router.state.location.searchStr).toBe('?mode=primary')

    await user.click(screen.getByRole('link', { name: 'Back to ranking' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Sample library ranking' })).toBeDefined()
    expect(router.state.location.pathname).toBe('/demo')
    expect(router.state.location.searchStr).toBe('?mode=primary')
  })

  it('keeps the A–Z sort from the list to the artist page and back', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/demo?mode=primary&sort=alpha')
    const list = await screen.findByRole('list', { name: 'Artists ranked by liked songs' })
    const [firstRow] = within(list).getAllByRole('listitem')

    await user.click(within(firstRow).getByRole('link'))

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/demo\/artist\//))
    expect(router.state.location.searchStr).toBe('?mode=primary&sort=alpha')

    await user.click(await screen.findByRole('link', { name: 'Back to ranking' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/demo'))
    expect(router.state.location.searchStr).toBe('?mode=primary&sort=alpha')
  })
})

describe('/', () => {
  // jsdom serves tests from localhost, where Spotify refuses the redirect, so home points to 127.0.0.1 instead.
  it('sends localhost to 127.0.0.1, and opens the demo from "Continue to demo"', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/')

    expect(await screen.findByRole('heading', { level: 1, name: 'Open this app on 127.0.0.1.' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Connect Spotify' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Open on 127.0.0.1' }).getAttribute('href')).toBe('http://127.0.0.1:3000/')
    const tryDemo = screen.getByRole('link', { name: 'Continue to demo' })
    expect(tryDemo.getAttribute('href')).toBe('/demo')

    await user.click(tryDemo)

    expect(await screen.findByRole('heading', { level: 1, name: 'Sample library ranking' })).toBeDefined()
    expect(router.state.location.pathname).toBe('/demo')
  })
})

describe('accessibility', () => {
  it('has no axe violations on the home page', async () => {
    const { container } = renderApp('/')
    await screen.findByRole('link', { name: 'Continue to demo' })

    await expectNoAxeViolations(container)
  })

  it.each(['/demo', '/demo?mode=primary'])('has no axe violations on the ranked list at %s', async (url) => {
    const { container } = renderApp(url)
    await screen.findByRole('list', { name: 'Artists ranked by liked songs' })

    await expectNoAxeViolations(container)
  })

  it('has no axe violations on an artist page', async () => {
    const [top] = rankArtists(testLibrary.tracks, 'all')
    const { container } = renderApp(`/demo/artist/${top.artist.id}`)
    await screen.findByRole('list', { name: `Liked songs by ${top.artist.name}` })

    await expectNoAxeViolations(container)
  })

  it('has no axe violations on an artist page that is not counted in the current mode', async () => {
    const { artist } = featuredOnlyArtist()
    const { container } = renderApp(`/demo/artist/${artist.id}?mode=primary`)
    await screen.findByRole('link', { name: 'Switch to all artists' })

    await expectNoAxeViolations(container)
  })
})

describe('existing routes', () => {

  it('renders the not-found page for an unknown path', async () => {
    const { container } = renderApp('/artists/top?mode=primary')

    expect(await screen.findByRole('heading', { level: 1, name: 'There’s no page at this address.' })).toBeDefined()
    expect(screen.getByText('404').dataset.tone).toBe('neutral')
    expect(screen.getByText('/artists/top')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Go to the home page' }).getAttribute('href')).toBe('/')
    expect(screen.getByRole('link', { name: 'Open the demo' }).getAttribute('href')).toBe('/demo')
    await expectNoAxeViolations(container)
  })
})
