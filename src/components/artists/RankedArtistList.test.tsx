// @vitest-environment jsdom
import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { barWidthPercent, sortRankings } from '../../library/presentation.ts'
import { rankArtists } from '../../library/rankings.ts'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { makeArtist, makeTrack } from '../../test/factories.ts'
import { renderWithRouter } from '../../test/render-with-router.ts'
import { RankedArtistList } from './RankedArtistList.tsx'

const ROW_COUNT = 2_000
const ROW_HEIGHT = 77

function manyRankings() {
  const tracks = Array.from({ length: ROW_COUNT }, (_, index) =>
    makeTrack({ artists: [makeArtist({ id: `artist-${index}`, name: `Artist ${index}` })] }),
  )
  return rankArtists(tracks, 'all')
}

function positions() {
  return screen.getAllByRole('listitem').map((item) => Number(item.getAttribute('aria-posinset')))
}

function focusedPosition() {
  return document.activeElement?.closest('[aria-posinset]')?.getAttribute('aria-posinset')
}

function scrollWindowTo(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
  window.dispatchEvent(new Event('scroll'))
}

// jsdom's scrollTo is a no-op stub; this one moves the window so the virtualizer can render the target row.
function followWindowScrollTo() {
  return vi.spyOn(window, 'scrollTo').mockImplementation(((options?: ScrollToOptions | number, y?: number) => {
    scrollWindowTo(typeof options === 'number' ? (y ?? 0) : (options?.top ?? window.scrollY))
  }) as typeof window.scrollTo)
}

// jsdom has no layout, so documentElement.scrollHeight is 0. virtual-core caps a scroll target at
// scrollHeight - innerHeight, which made End scroll to -768 instead of the bottom of the list.
function giveDocumentListHeight() {
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    get: () => ROW_COUNT * ROW_HEIGHT + window.innerHeight,
  })
}

// The sort toggle in the panel header comes first in Tab order.
async function tabIntoList(user: ReturnType<typeof userEvent.setup>) {
  await user.tab()
  await user.tab()
}

function ManyArtists() {
  return (
    <RankedArtistList
      rankings={manyRankings()}
      leaderCount={1}
      trackCount={ROW_COUNT}
      mode="all"
      sort="count"
      basePath="/demo"
      label="2,000 artists"
    />
  )
}

afterEach(() => {
  cleanup()
  scrollWindowTo(0)
  vi.restoreAllMocks()
  Reflect.deleteProperty(document.documentElement, 'scrollHeight')
})

describe('RankedArtistList', () => {
  it('renders only a window of rows, each with its position in the full list', async () => {
    renderWithRouter(<ManyArtists />)

    const items = await screen.findAllByRole('listitem')

    expect(items.length).toBeGreaterThan(0)
    expect(items.length).toBeLessThan(ROW_COUNT)
    expect(items.every((item) => item.getAttribute('aria-setsize') === String(ROW_COUNT))).toBe(true)
    expect(positions()[0]).toBe(1)
  })

  // Fails if the 'use no memo' directive is removed: compiled, the virtualizer's rows never update.
  it('renders later rows after the window scrolls', async () => {
    renderWithRouter(<ManyArtists />)
    await screen.findAllByRole('listitem')
    const before = positions()

    await act(async () => {
      scrollWindowTo(72 * 1_000)
    })

    expect(Math.min(...positions())).toBeGreaterThan(Math.max(...before))
  })

  it('links each row to the artist page with the current mode and a readable name', async () => {
    const artistA = makeArtist({ id: 'artist-a', name: 'Artist A' })
    const artistB = makeArtist({ id: 'artist-b', name: 'Artist B' })
    const rankings = rankArtists(
      [makeTrack({ artists: [artistA] }), makeTrack({ artists: [artistA, artistB] }), makeTrack()],
      'all',
    )

    renderWithRouter(
      <RankedArtistList
        rankings={rankings}
        leaderCount={2}
        trackCount={3}
        mode="primary"
        sort="count"
        basePath="/demo"
        label="3"
      />,
    )

    const leader = await screen.findByRole('link', { name: 'Rank 1, Artist A, 2 liked songs, 66.7% of library' })
    const second = screen.getByRole('link', { name: /^Rank 2, tied, Artist B, 1 liked song, 33\.3% of library$/ })
    expect(leader.getAttribute('href')).toBe('/demo/artist/artist-a?mode=primary&sort=count')
    expect(second.getAttribute('href')).toBe('/demo/artist/artist-b?mode=primary&sort=count')
  })

  it('shows the count, the share as text, and a tie marker only on tied ranks', async () => {
    const solo = makeArtist({ id: 'solo', name: 'Solo' })
    const tracks = [makeTrack({ artists: [solo] }), makeTrack({ artists: [solo] }), makeTrack(), makeTrack()]
    const rankings = rankArtists(tracks, 'all')

    renderWithRouter(
      <RankedArtistList
        rankings={rankings}
        leaderCount={2}
        trackCount={4}
        mode="all"
        sort="count"
        basePath="/demo"
        label="3 artists"
      />,
    )

    const [leader, tiedA, tiedB] = await screen.findAllByRole('listitem')
    expect(within(leader).getByText('50.0%')).toBeDefined()
    expect(within(leader).queryByText('=')).toBeNull()
    expect(within(tiedA).getByText('=')).toBeDefined()
    expect(within(tiedB).getByText('25.0%')).toBeDefined()
  })

  it('keeps count ranks in A–Z order, dimmed, with no tie markers and a Rank column', async () => {
    const solo = makeArtist({ id: 'solo', name: 'Zed' })
    const tracks = [makeTrack({ artists: [solo] }), makeTrack({ artists: [solo] }), makeTrack(), makeTrack()]
    const rankings = sortRankings(rankArtists(tracks, 'all'), 'alpha')

    const { container } = renderWithRouter(
      <RankedArtistList
        rankings={rankings}
        leaderCount={2}
        trackCount={4}
        mode="all"
        sort="alpha"
        basePath="/demo"
        label="3 artists"
      />,
    )

    const rows = await screen.findAllByRole('listitem')
    const zed = within(rows[2]).getByRole('link')
    expect(zed.getAttribute('aria-label')).toBe('Rank 1, Zed, 2 liked songs, 50.0% of library')
    expect(within(rows[0]).getByRole('link').getAttribute('aria-label')).toMatch(/^Rank 2, Artist /)
    expect(screen.queryByText('=')).toBeNull()
    expect(container.querySelector('[data-slot="column-header"]')?.firstElementChild?.textContent).toBe('Rank')
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'A to Z' }).checked).toBe(true)
  })

  it('links rows under the live path and paints photos over the top artists', async () => {
    const artistA = makeArtist({ id: 'artist-a', name: 'Artist A' })
    const artistB = makeArtist({ id: 'artist-b', name: 'Artist B' })
    const rankings = rankArtists([makeTrack({ artists: [artistA] }), makeTrack({ artists: [artistB] })], 'all')

    renderWithRouter(
      <RankedArtistList
        rankings={rankings}
        leaderCount={1}
        trackCount={2}
        mode="primary"
        sort="alpha"
        basePath="/"
        label="2 artists"
        photos={{ 'artist-a': 'https://i.scdn.co/image/a' }}
      />,
    )

    const [rowA, rowB] = await screen.findAllByRole('listitem')
    expect(within(rowA).getByRole('link').getAttribute('href')).toBe('/artist/artist-a?mode=primary&sort=alpha')
    expect(rowA.querySelector('img')?.getAttribute('src')).toBe('https://i.scdn.co/image/a')
    expect(rowB.querySelector('img')).toBeNull()
  })

  it('names the panel and hides the decorative column header', async () => {
    const { container } = renderWithRouter(<ManyArtists />)

    expect(await screen.findByRole('heading', { level: 2, name: '2,000 artists' })).toBeDefined()
    expect(container.querySelector('[data-slot="column-header"]')?.getAttribute('aria-hidden')).toBe('true')
    await expectNoAxeViolations(container)
  })

  it('sizes each bar relative to the leader count', async () => {
    const artist = makeArtist({ id: 'artist-a', name: 'Artist A' })
    const rankings = rankArtists([makeTrack({ artists: [artist] })], 'all')

    renderWithRouter(
      <RankedArtistList
        rankings={rankings}
        leaderCount={4}
        trackCount={1}
        mode="all"
        sort="count"
        basePath="/demo"
        label="1 artist"
      />,
    )

    const link = await screen.findByRole('link', { name: /^Rank 1, Artist A,/ })
    expect(link.querySelector<HTMLElement>('[data-slot="bar"]')?.style.width).toBe(`${barWidthPercent(1, 4)}%`)
  })

  it('shows an empty state when there are no rankings', async () => {
    renderWithRouter(
      <RankedArtistList
        rankings={[]}
        leaderCount={0}
        trackCount={0}
        mode="all"
        sort="count"
        basePath="/demo"
        label="No artists yet"
      />,
    )

    expect(await screen.findByText('No liked songs to rank')).toBeDefined()
    expect(screen.queryByRole('list')).toBeNull()
  })
})

describe('RankedArtistList keyboard navigation', () => {
  it('moves focus to the next and previous row with the arrow keys', async () => {
    const user = userEvent.setup()
    renderWithRouter(<ManyArtists />)
    await screen.findAllByRole('listitem')

    await tabIntoList(user)
    expect(focusedPosition()).toBe('1')
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(focusedPosition()).toBe('3')
    await user.keyboard('{ArrowUp}')
    expect(focusedPosition()).toBe('2')
  })

  it('jumps to the last and first rows with End and Home, scrolling them into view', async () => {
    const user = userEvent.setup()
    giveDocumentListHeight()
    const scrollTo = followWindowScrollTo()
    renderWithRouter(<ManyArtists />)
    await screen.findAllByRole('listitem')
    await tabIntoList(user)

    await user.keyboard('{End}')
    await waitFor(() => expect(focusedPosition()).toBe(String(ROW_COUNT)))
    expect(scrollTo).toHaveBeenCalled()

    await user.keyboard('{Home}')
    await waitFor(() => expect(focusedPosition()).toBe('1'))
  })

  // Browsers only draw the keyboard focus ring when focus moves from an element that had one. If the focused row
  // unmounts before the target renders, focus falls to <body> and the target gets no ring.
  it('moves focus straight from row to row on End, never dropping it to the page', async () => {
    const user = userEvent.setup()
    giveDocumentListHeight()
    followWindowScrollTo()
    renderWithRouter(<ManyArtists />)
    await screen.findAllByRole('listitem')
    await tabIntoList(user)
    const firstRow = document.activeElement
    const previouslyFocused: Array<EventTarget | null> = []
    const record = (event: FocusEvent) => previouslyFocused.push(event.relatedTarget)
    document.addEventListener('focusin', record)

    await user.keyboard('{End}')
    await waitFor(() => expect(focusedPosition()).toBe(String(ROW_COUNT)))
    document.removeEventListener('focusin', record)

    expect(previouslyFocused).toEqual([firstRow])
  })

  // Scrolling the focused row away must not throw focus back to the page.
  it('keeps the focused row in the page while the list scrolls away from it', async () => {
    const user = userEvent.setup()
    renderWithRouter(<ManyArtists />)
    await screen.findAllByRole('listitem')
    await tabIntoList(user)
    const focused = document.activeElement

    await act(async () => {
      scrollWindowTo(ROW_HEIGHT * 1_000)
    })

    expect(focused?.isConnected).toBe(true)
    expect(document.activeElement).toBe(focused)
  })

  it('lets Tab leave the list after one row instead of stepping through every row', async () => {
    const user = userEvent.setup()
    renderWithRouter(
      <>
        <ManyArtists />
        <button type="button">After the list</button>
      </>,
    )
    await screen.findAllByRole('listitem')

    await tabIntoList(user)
    expect(focusedPosition()).toBe('1')
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'After the list' }))
  })

  it('ignores arrow keys when focus is outside the list', async () => {
    const user = userEvent.setup()
    renderWithRouter(
      <>
        <button type="button">Before the list</button>
        <ManyArtists />
      </>,
    )
    await screen.findAllByRole('listitem')
    const before = screen.getByRole('button', { name: 'Before the list' })
    before.focus()

    await user.keyboard('{ArrowDown}')

    expect(document.activeElement).toBe(before)
  })

  // Without this, scrolling the active row out of the window would leave no row reachable with Tab.
  it('keeps exactly one rendered row reachable with Tab after scrolling away from the active row', async () => {
    renderWithRouter(<ManyArtists />)
    await screen.findAllByRole('listitem')

    await act(async () => {
      scrollWindowTo(ROW_HEIGHT * 1_000)
    })

    const tabbable = screen.getAllByRole('link').filter((link) => link.getAttribute('tabindex') === '0')
    expect(tabbable).toHaveLength(1)
  })
})
