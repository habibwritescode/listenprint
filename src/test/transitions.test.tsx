// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { rankArtists } from '../library/rankings.ts'
import { artistTileName, artistTransitionTypes } from '../navigation/view-transitions.ts'
import { createTestSession, signedInStorage } from './auth-session.ts'
import { spotifyLibrary, storeWithLibrary } from './library-session.ts'
import { setupSpotifyMocks } from './msw-server.ts'
import { renderApp, testLibrary } from './render-app.ts'
import { fakeViewTransitions } from './view-transition.ts'

setupSpotifyMocks()

beforeAll(async () => {
  await Promise.all([
    import('../routes/DemoPage.tsx'),
    import('../routes/DemoArtistPage.tsx'),
    import('../components/library/SignedInHome.tsx'),
    import('../components/library/LiveLibrary.tsx'),
    import('../routes/ArtistPage.tsx'),
  ])
})

let restore = () => {}

afterEach(() => {
  cleanup()
  restore()
})

// The router's own browser setting also checks support and reduced motion; those have unit tests.
const viewTransition = { types: artistTransitionTypes }

function withFakeTransitions() {
  const fake = fakeViewTransitions()
  restore = fake.restore
  return fake.transitions
}

async function rankingList() {
  return screen.findByRole('list', { name: 'Artists ranked by liked songs' })
}

describe('list ↔ artist view transitions on the demo', () => {
  it('opens an artist with one artist-open transition, whose new state holds the header tile', async () => {
    const transitions = withFakeTransitions()
    const user = userEvent.setup()
    const [top] = rankArtists(testLibrary.tracks, 'all')
    renderApp('/demo', { viewTransition })

    await user.click(within(await rankingList()).getByRole('link', { name: top.artist.name }))

    await waitFor(() => expect(transitions).toHaveLength(1))
    expect(transitions[0].types).toEqual(['artist-open'])
    expect(transitions[0].heading).toBe(top.artist.name)
    expect(transitions[0].tiles).toEqual([artistTileName(top.artist.id)])
  })

  it('closes back to the ranking with artist-close, landing on a rendered row tile of the same name', async () => {
    const transitions = withFakeTransitions()
    const user = userEvent.setup()
    const [top] = rankArtists(testLibrary.tracks, 'all')
    renderApp('/demo', { viewTransition })
    await user.click(within(await rankingList()).getByRole('link', { name: top.artist.name }))
    await waitFor(() => expect(transitions).toHaveLength(1))

    await user.click(await screen.findByRole('link', { name: 'Back to ranking' }))

    await waitFor(() => expect(transitions).toHaveLength(2))
    expect(transitions[1].types).toEqual(['artist-close'])
    expect(transitions[1].tiles).toContain(artistTileName(top.artist.id))
    expect(new Set(transitions[1].tiles).size).toBe(transitions[1].tiles.length)
  })

  it('animates the browser back button like the back link', async () => {
    const transitions = withFakeTransitions()
    const user = userEvent.setup()
    const { router } = renderApp('/demo', { viewTransition })
    await user.click(within(await rankingList()).getAllByRole('link')[0])
    await waitFor(() => expect(transitions).toHaveLength(1))

    router.history.back()

    await waitFor(() => expect(transitions).toHaveLength(2))
    expect(transitions[1].types).toEqual(['artist-close'])
  })

  it('does not animate mode or sort changes', async () => {
    const transitions = withFakeTransitions()
    const user = userEvent.setup()
    const [top] = rankArtists(testLibrary.tracks, 'all')
    const { router } = renderApp('/demo', { viewTransition })
    await rankingList()

    await user.click(screen.getByRole('radio', { name: 'Primary artist only' }))
    await user.click(screen.getByRole('radio', { name: 'A to Z' }))
    await waitFor(() => expect(router.state.location.searchStr).toBe('?mode=primary&sort=alpha'))
    const artist = { to: '/demo/artist/$artistId', params: { artistId: top.artist.id } } as const
    await router.navigate({ ...artist, search: { mode: 'all', sort: 'count' } })
    await screen.findByRole('heading', { level: 1, name: top.artist.name })
    await router.navigate({ ...artist, search: { mode: 'primary', sort: 'count' } })
    await waitFor(() => expect(router.state.location.searchStr).toBe('?mode=primary'))

    expect(transitions.map((transition) => transition.types)).toEqual([['artist-open']])
  })

  // Browsers without the API, or without transition types, take the plain path: same pages, same history.
  it('navigates the same way where view transitions are unavailable', async () => {
    const user = userEvent.setup()
    const [top] = rankArtists(testLibrary.tracks, 'all')
    const { router } = renderApp('/demo', { viewTransition })

    await user.click(within(await rankingList()).getByRole('link', { name: top.artist.name }))
    expect(await screen.findByRole('heading', { level: 1, name: top.artist.name })).toBeDefined()
    await user.click(screen.getByRole('link', { name: 'Back to ranking' }))

    await rankingList()
    expect(router.state.location.pathname).toBe('/demo')
    expect(router.history.canGoBack()).toBe(false)
  })
})

describe('list ↔ artist view transitions on the live library', () => {
  function signedIn() {
    return createTestSession({ localStorage: signedInStorage() }).session
  }

  // The artist page loads code the ranking doesn't use. If it isn't loaded by the time the browser takes its snapshot,
  // the new state is empty and the tile has nowhere to land.
  it('renders the live artist header in the state the first open captures', async () => {
    const transitions = withFakeTransitions()
    const user = userEvent.setup()
    const [top] = rankArtists(spotifyLibrary().tracks, 'all')
    renderApp('/', { auth: signedIn(), store: await storeWithLibrary(), viewTransition })

    await user.click(within(await rankingList()).getByRole('link', { name: top.artist.name }))

    await waitFor(() => expect(transitions).toHaveLength(1))
    expect(transitions[0].types).toEqual(['artist-open'])
    expect(transitions[0].heading).toBe(top.artist.name)
    expect(transitions[0].tiles).toEqual([artistTileName(top.artist.id)])
  })

  it('closes back to the live ranking onto the same tile', async () => {
    const transitions = withFakeTransitions()
    const user = userEvent.setup()
    const [top] = rankArtists(spotifyLibrary().tracks, 'all')
    renderApp('/', { auth: signedIn(), store: await storeWithLibrary(), viewTransition })
    await user.click(within(await rankingList()).getByRole('link', { name: top.artist.name }))
    await waitFor(() => expect(transitions).toHaveLength(1))

    await user.click(await screen.findByRole('link', { name: 'Back to ranking' }))

    await waitFor(() => expect(transitions).toHaveLength(2))
    expect(transitions[1].types).toEqual(['artist-close'])
    expect(transitions[1].tiles).toContain(artistTileName(top.artist.id))
  })
})
