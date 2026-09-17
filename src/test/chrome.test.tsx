// @vitest-environment jsdom
import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ARRIVAL_SETTLE_MS } from '../hooks/scroll-visibility.ts'
import { rankArtists } from '../library/rankings.ts'
import { expectNoAxeViolations } from './axe.ts'
import { renderApp, testLibrary } from './render-app.ts'

beforeAll(async () => {
  await Promise.all([import('../routes/DemoPage.tsx'), import('../routes/DemoArtistPage.tsx')])
})

afterEach(cleanup)

function siteHeader() {
  return screen.getByTestId('site-header')
}

describe('site header', () => {
  it('shows the wordmark, the sample-data chip, the mode pills and the library views on /demo', async () => {
    renderApp('/demo?mode=primary')
    await screen.findByRole('list', { name: 'Artists ranked by liked songs' })
    const header = within(siteHeader())

    expect(header.getByRole('link', { name: 'listenprint' }).getAttribute('href')).toBe('/')
    expect(header.getByText('Sample data')).toBeDefined()
    expect(header.getByRole('group', { name: 'Ranking mode' })).toBeDefined()
    expect(header.getByRole<HTMLInputElement>('radio', { name: 'Primary artist only' }).checked).toBe(true)
    expect(header.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'listenprint',
      'Artists',
      'Genres',
      'Timeline',
    ])
    await expectNoAxeViolations(siteHeader())
  })

  it('has no chip or mode pills on the home page', async () => {
    renderApp('/')
    await screen.findByRole('heading', { level: 1 })
    const header = within(siteHeader())

    expect(header.getByRole('link', { name: 'listenprint' })).toBeDefined()
    expect(header.queryByText('Sample data')).toBeNull()
    expect(header.queryByRole('group', { name: 'Ranking mode' })).toBeNull()
  })
})

describe('back bar on artist pages', () => {
  it('replaces the header on a demo artist page, keeping the mode and the chip', async () => {
    const [top] = rankArtists(testLibrary.tracks, 'primary')
    renderApp(`/demo/artist/${top.artist.id}?mode=primary&sort=alpha`)
    await screen.findByRole('heading', { level: 1, name: top.artist.name })
    const bar = within(siteHeader())

    const back = bar.getByRole('link', { name: 'Back to ranking' })
    expect(back.getAttribute('href')).toBe('/demo?mode=primary&sort=alpha')
    expect(bar.getByText('Sample data')).toBeDefined()
    expect(bar.queryByRole('link', { name: 'listenprint' })).toBeNull()
    expect(bar.queryByRole('group', { name: 'Ranking mode' })).toBeNull()
    await expectNoAxeViolations(siteHeader())
  })

  it('goes back to the home page from a live artist page, with no chip', async () => {
    renderApp('/artist/abc123')

    await waitFor(() => expect(within(siteHeader()).getByRole('link', { name: 'Back to ranking' })).toBeDefined())
    expect(within(siteHeader()).getByRole('link', { name: 'Back to ranking' }).getAttribute('href')).toBe('/')
    expect(within(siteHeader()).queryByText('Sample data')).toBeNull()
  })
})

describe('site header across page changes', () => {
  // As in a browser: fired at the document and bubbling to the window, so the router's listener and the header's
  // both hear it.
  function scrollWindowTo(y: number) {
    Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
    document.dispatchEvent(new Event('scroll', { bubbles: true }))
  }

  /** The router and the virtualizer scroll the window; here that moves `scrollY` and fires a scroll event. */
  function followWindowScrollTo() {
    vi.spyOn(window, 'scrollTo').mockImplementation(((xOrOptions?: number | ScrollToOptions, y?: number) => {
      const top = typeof xOrOptions === 'object' ? xOrOptions.top : y
      if (top !== undefined) scrollWindowTo(top)
    }) as typeof window.scrollTo)
  }

  async function scrollDownTheList() {
    for (let y = 150; y <= 3_000; y += 150) {
      await act(async () => scrollWindowTo(y))
    }
  }

  afterEach(() => {
    vi.restoreAllMocks()
    scrollWindowTo(0)
  })

  // Going back restores the list thousands of pixels down in one jump. Read as scrolling down, it slid the header out
  // straight after arriving, which looked like a flicker.
  it('stays in view when Back restores a list that was scrolled down', async () => {
    const user = userEvent.setup()
    followWindowScrollTo()
    renderApp('/demo')
    const list = await screen.findByRole('list', { name: 'Artists ranked by liked songs' })
    await scrollDownTheList()
    await waitFor(() => expect(siteHeader().hasAttribute('data-hidden')).toBe(true))

    await user.click(within(list).getAllByRole('link')[0])
    await screen.findByRole('heading', { level: 1 })
    await waitFor(() => expect(siteHeader().hasAttribute('data-hidden')).toBe(false))
    await user.click(within(siteHeader()).getByRole('link', { name: 'Back to ranking' }))
    await screen.findByRole('list', { name: 'Artists ranked by liked songs' })
    await waitFor(() => expect(window.scrollY).toBe(3_000))

    expect(siteHeader().hasAttribute('data-hidden')).toBe(false)
    expect(siteHeader().hasAttribute('data-scrolled')).toBe(true)
    // Its background appears at once rather than fading in over the rows it covers.
    expect(siteHeader().hasAttribute('data-instant')).toBe(true)

    const settled = performance.now() + ARRIVAL_SETTLE_MS + 1
    vi.spyOn(performance, 'now').mockReturnValue(settled)
    await act(async () => scrollWindowTo(3_150))
    expect(siteHeader().hasAttribute('data-hidden')).toBe(true)
    expect(siteHeader().hasAttribute('data-instant')).toBe(false)
  })
})
