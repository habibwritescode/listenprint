// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
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

function headerSummary({ rank, count }: ArtistRanking) {
  return `#${rank} · ${countFormat.format(count)} liked ${count === 1 ? 'song' : 'songs'}`
}

function topRowName(mode: RankingMode) {
  const [top] = rankArtists(testLibrary.tracks, mode)
  return `Rank 1, ${top.artist.name}, ${top.count} liked ${top.count === 1 ? 'song' : 'songs'}`
}

describe('/demo search params', () => {
  it('resolves ?mode=primary and keeps it in the URL', async () => {
    const { router } = renderApp('/demo?mode=primary')

    await screen.findByRole('heading', { name: 'Demo library' })

    expect(demoSearch(router)).toEqual({ mode: 'primary' })
    expect(router.state.location.searchStr).toBe('?mode=primary')
  })

  it.each(['/demo?mode=bogus', '/demo?mode=all', '/demo'])(
    'resolves %s to all mode with no mode left in the URL',
    async (url) => {
      const { router } = renderApp(url)

      await screen.findByRole('heading', { name: 'Demo library' })

      expect(demoSearch(router)).toEqual({ mode: 'all' })
      expect(router.state.location.searchStr).toBe('')
    },
  )
})

describe('/demo ranking mode', () => {
  it('checks the option that matches the URL', async () => {
    renderApp('/demo?mode=primary')

    await screen.findByRole('radio', { name: 'Primary artist only' })

    expect(radio('Primary artist only').checked).toBe(true)
    expect(radio('Every credited artist').checked).toBe(false)
  })

  it('switches mode in the URL without adding history entries', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/demo')
    await screen.findByRole('radio', { name: 'Primary artist only' })
    const historyLength = router.history.length

    await user.click(radio('Primary artist only'))
    await waitFor(() => expect(router.state.location.searchStr).toBe('?mode=primary'))
    await user.click(radio('Every credited artist'))
    await waitFor(() => expect(router.state.location.searchStr).toBe(''))

    expect(router.history.length).toBe(historyLength)
  })

  it.each(['all', 'primary'] as const)('shows the stats and top artist for %s mode', async (mode) => {
    const rankings = rankArtists(testLibrary.tracks, mode)

    renderApp(mode === 'all' ? '/demo' : '/demo?mode=primary')

    expect(await screen.findByRole('link', { name: topRowName(mode) })).toBeDefined()
    expect(statValue('Liked tracks')).toBe(countFormat.format(testLibrary.tracks.length))
    expect(statValue('Artists ranked')).toBe(countFormat.format(rankings.length))
    expect(statValue('Songs by #1')).toBe(countFormat.format(rankings[0].count))
  })

  it('updates the stats when the mode changes', async () => {
    const user = userEvent.setup()
    const primaryArtists = rankArtists(testLibrary.tracks, 'primary').length
    const allArtists = rankArtists(testLibrary.tracks, 'all').length
    expect(primaryArtists).not.toBe(allArtists)
    renderApp('/demo')
    await screen.findByRole('radio', { name: 'Primary artist only' })

    await user.click(radio('Primary artist only'))

    await waitFor(() => expect(statValue('Artists ranked')).toBe(countFormat.format(primaryArtists)))
    expect(screen.getByRole('link', { name: topRowName('primary') })).toBeDefined()
  })
})

describe('/demo/artist/$artistId', () => {
  it('renders the page for an artist in the demo library', async () => {
    const artist = firstCatalogArtist()

    renderApp(`/demo/artist/${artist.id}`)

    expect(await screen.findByRole('heading', { level: 1, name: artist.name })).toBeDefined()
  })

  it('renders the not-found page for an artist that is not in the demo library', async () => {
    renderApp('/demo/artist/does-not-exist')

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeDefined()
  })

  it.each(['all', 'primary'] as const)('shows the rank, count, and counted tracks for %s mode', async (mode) => {
    const ranking = rankArtists(testLibrary.tracks, mode)[1]

    renderApp(`/demo/artist/${ranking.artist.id}${mode === 'primary' ? '?mode=primary' : ''}`)

    expect(await screen.findByText(headerSummary(ranking))).toBeDefined()
    const list = screen.getByRole('list', { name: `Liked songs by ${ranking.artist.name}` })
    expect(list.querySelector('li')?.getAttribute('aria-setsize')).toBe(String(ranking.count))
  })

  it('explains that a featured-only artist is not counted in primary mode and switches to all mode', async () => {
    const user = userEvent.setup()
    const ranking = featuredOnlyArtist()
    const { router } = renderApp(`/demo/artist/${ranking.artist.id}?mode=primary`)

    expect(await screen.findByText(/only credited as a featured artist/)).toBeDefined()
    expect(screen.queryByRole('list', { name: /Liked songs by/ })).toBeNull()

    await user.click(screen.getByRole('link', { name: 'Count every credited artist' }))

    expect(await screen.findByText(headerSummary(ranking))).toBeDefined()
    expect(router.state.location.pathname).toBe(`/demo/artist/${ranking.artist.id}`)
    expect(router.state.location.searchStr).toBe('')
  })
})

describe('list to detail navigation', () => {
  it('keeps primary mode from the list to the artist page and back', async () => {
    const user = userEvent.setup()
    const [top] = rankArtists(testLibrary.tracks, 'primary')
    const { router } = renderApp('/demo?mode=primary')

    await user.click(await screen.findByRole('link', { name: topRowName('primary') }))

    expect(await screen.findByRole('heading', { level: 1, name: top.artist.name })).toBeDefined()
    expect(screen.getByText(headerSummary(top))).toBeDefined()
    expect(router.state.location.pathname).toBe(`/demo/artist/${top.artist.id}`)
    expect(router.state.location.searchStr).toBe('?mode=primary')

    await user.click(screen.getByRole('link', { name: 'Back to rankings' }))

    expect(await screen.findByRole('heading', { name: 'Demo library' })).toBeDefined()
    expect(router.state.location.pathname).toBe('/demo')
    expect(router.state.location.searchStr).toBe('?mode=primary')
  })
})

describe('/', () => {
  it('introduces the app and opens the demo from "Try the demo"', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/')

    expect(await screen.findByRole('heading', { level: 1, name: 'Your artist rankings' })).toBeDefined()
    const tryDemo = screen.getByRole('link', { name: 'Try the demo' })
    expect(tryDemo.getAttribute('href')).toBe('/demo')

    await user.click(tryDemo)

    expect(await screen.findByRole('heading', { name: 'Demo library' })).toBeDefined()
    expect(router.state.location.pathname).toBe('/demo')
  })
})

describe('accessibility', () => {
  it('has no axe violations on the home page', async () => {
    const { container } = renderApp('/')
    await screen.findByRole('link', { name: 'Try the demo' })

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
    await screen.findByRole('link', { name: 'Count every credited artist' })

    await expectNoAxeViolations(container)
  })
})

describe('existing routes', () => {

  it('still renders the not-found page for an unknown path', async () => {
    renderApp('/no-such-page')

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeDefined()
  })
})
