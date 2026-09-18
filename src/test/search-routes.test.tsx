// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { rankArtists } from '../library/rankings.ts'
import { createTestSession, signedInStorage } from './auth-session.ts'
import { expectNoAxeViolations } from './axe.ts'
import { storeWithLibrary } from './library-session.ts'
import { setupSpotifyMocks } from './msw-server.ts'
import { renderApp, testLibrary } from './render-app.ts'

setupSpotifyMocks()

beforeAll(async () => {
  await Promise.all([import('../routes/DemoPage.tsx'), import('../components/library/SignedInHome.tsx')])
})

afterEach(cleanup)

const topArtist = rankArtists(testLibrary.tracks, 'all')[0].artist

function rankedList() {
  return screen.findByRole('list', { name: 'Artists ranked by liked songs' })
}

function field() {
  return screen.getByRole('searchbox', { name: 'Search artists' })
}

/** The list panel's own heading, which the export row above the list would otherwise make ambiguous. */
function panelHeading() {
  return screen.getAllByRole('heading', { level: 2 }).find((heading) => heading.id !== 'export-title')?.textContent
}

describe('searching the demo ranking', () => {
  it('filters the list as you type and settles in the URL', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/demo')
    await rankedList()

    await user.type(field(), topArtist.name.slice(0, 4))

    await waitFor(() => expect(panelHeading()).toMatch(/match “/))
    const names = within(await rankedList())
      .getAllByRole('link')
      .map((link) => link.textContent)
    expect(names).toContain(topArtist.name)
    await waitFor(() => expect(router.state.location.searchStr).toBe(`?q=${topArtist.name.slice(0, 4)}`))
  })

  it('renders a pasted filtered link straight away, highlighting the match', async () => {
    const { container } = renderApp(`/demo?q=${encodeURIComponent(topArtist.name)}`)

    const list = await rankedList()
    const names = within(list)
      .getAllByRole('link')
      .map((link) => link.textContent ?? '')
    expect(names).toContain(topArtist.name)
    expect(names.every((name) => name.toLowerCase().includes(topArtist.name.toLowerCase()))).toBe(true)
    expect(within(list).getAllByText(topArtist.name, { selector: 'mark' }).length).toBeGreaterThan(0)
    expect(panelHeading()).toMatch(new RegExp(`artists? match(es)? “${topArtist.name}”$`))
    expect(screen.getByText(/filtered view has its own link/)).toBeDefined()
    await expectNoAxeViolations(container)
  })

  // The library didn't change, only the filter, so the headline figures must not flicker to zero.
  it('says nothing matches, keeping the stats above it', async () => {
    const { container } = renderApp('/demo?q=zzzznothing')

    expect(await screen.findByText('Nothing matches “zzzznothing”')).toBeDefined()
    expect(screen.getByText(/artist names, not song or album titles/)).toBeDefined()
    expect(screen.getByText('Saved tracks')).toBeDefined()
    expect(screen.queryByRole('list', { name: 'Artists ranked by liked songs' })).toBeNull()
    await expectNoAxeViolations(container)
  })

  it('clears the filter from the empty state', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/demo?q=zzzznothing')
    await screen.findByText('Nothing matches “zzzznothing”')

    await user.click(screen.getByRole('button', { name: 'Clear the search' }))

    await rankedList()
    await waitFor(() => expect(router.state.location.searchStr).toBe(''))
    expect(field()).toHaveProperty('value', '')
  })

  it('keeps the query when the ranking mode changes', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/demo?q=a')
    await rankedList()

    await user.click(screen.getByRole('radio', { name: 'Primary artist only' }))

    await waitFor(() => expect(router.state.location.searchStr).toContain('mode=primary'))
    expect(router.state.location.searchStr).toContain('q=a')
    expect(field()).toHaveProperty('value', 'a')
    expect(panelHeading()).toMatch(/match “a”/)
  })

  // The filter has to survive the click: a row link that dropped it re-rendered the list unfiltered before the
  // browser captured it, so the list-to-artist transition had nothing to move from.
  it('carries the filter onto the artist page, and back again', async () => {
    const user = userEvent.setup()
    const { router } = renderApp(`/demo?q=${encodeURIComponent(topArtist.name)}`)
    const list = await rankedList()
    const filtered = within(list).getAllByRole('link').length

    await user.click(within(list).getAllByRole('link', { name: topArtist.name })[0])

    await screen.findByRole('heading', { level: 1, name: topArtist.name })
    expect(router.state.location.searchStr).toContain(`q=${encodeURIComponent(topArtist.name).replace(/%20/g, '+')}`)

    await user.click(screen.getByRole('link', { name: 'Back to ranking' }))

    const back = await rankedList()
    expect(within(back).getAllByRole('link')).toHaveLength(filtered)
    expect(field()).toHaveProperty('value', topArtist.name)
  })

  // A filtered list is the same ranking with rows hidden, so the numbers stay the library's.
  it('does not renumber the ranks it shows', async () => {
    const second = rankArtists(testLibrary.tracks, 'all')[1].artist
    renderApp(`/demo?q=${encodeURIComponent(second.name)}`)

    const rows = within(await rankedList()).getAllByRole('listitem')
    expect(rows[0].textContent?.startsWith('2')).toBe(true)
  })
})

describe('searching a live library', () => {
  it('filters the saved library the same way', async () => {
    const user = userEvent.setup()
    const auth = createTestSession({ localStorage: signedInStorage() }).session
    const { router } = renderApp('/', { auth, store: await storeWithLibrary() })
    await rankedList()

    await user.type(field(), 'Saved Artist 1')

    await waitFor(() => expect(panelHeading()).toBe('1 artist matches “Saved Artist 1”'))
    await waitFor(() => expect(router.state.location.searchStr).toBe('?q=Saved+Artist+1'))
  })

  it('has no field on pages with nothing to filter', async () => {
    renderApp('/demo/timeline')

    await screen.findByRole('heading', { level: 1, name: 'Library timeline' })
    expect(screen.queryByRole('searchbox')).toBeNull()
  })
})
