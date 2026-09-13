// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { rankArtists } from '../library/rankings.ts'
import type { RankingMode } from '../library/types.ts'
import type { AppRouter } from '../router.ts'
import { renderApp, testLibrary } from './render-app.ts'

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
})

describe('existing routes', () => {
  it('still renders the home page', async () => {
    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Your artist rankings' })).toBeDefined()
  })

  it('still renders the not-found page for an unknown path', async () => {
    renderApp('/no-such-page')

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeDefined()
  })
})
