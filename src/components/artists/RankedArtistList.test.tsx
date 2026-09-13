// @vitest-environment jsdom
import { act, cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { barWidthPercent } from '../../library/presentation.ts'
import { rankArtists } from '../../library/rankings.ts'
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

afterEach(() => {
  cleanup()
  scrollWindowTo(0)
  vi.restoreAllMocks()
  Reflect.deleteProperty(document.documentElement, 'scrollHeight')
})

describe('RankedArtistList', () => {
  it('renders only a window of rows, each with its position in the full list', async () => {
    renderWithRouter(<RankedArtistList rankings={manyRankings()} leaderCount={1} mode="all" />)

    const items = await screen.findAllByRole('listitem')

    expect(items.length).toBeGreaterThan(0)
    expect(items.length).toBeLessThan(ROW_COUNT)
    expect(items.every((item) => item.getAttribute('aria-setsize') === String(ROW_COUNT))).toBe(true)
    expect(positions()[0]).toBe(1)
  })

  // Fails if the 'use no memo' directive is removed: compiled, the virtualizer's rows never update.
  it('renders later rows after the window scrolls', async () => {
    renderWithRouter(<RankedArtistList rankings={manyRankings()} leaderCount={1} mode="all" />)
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
      [makeTrack({ artists: [artistA] }), makeTrack({ artists: [artistA, artistB] })],
      'all',
    )

    renderWithRouter(<RankedArtistList rankings={rankings} leaderCount={2} mode="primary" />)

    const leader = await screen.findByRole('link', { name: 'Rank 1, Artist A, 2 liked songs' })
    const second = screen.getByRole('link', { name: 'Rank 2, Artist B, 1 liked song' })
    expect(leader.getAttribute('href')).toBe('/demo/artist/artist-a?mode=primary')
    expect(second.getAttribute('href')).toBe('/demo/artist/artist-b?mode=primary')
  })

  it('sizes each bar relative to the leader count', async () => {
    const artist = makeArtist({ id: 'artist-a', name: 'Artist A' })
    const rankings = rankArtists([makeTrack({ artists: [artist] })], 'all')

    renderWithRouter(<RankedArtistList rankings={rankings} leaderCount={4} mode="all" />)

    const link = await screen.findByRole('link', { name: 'Rank 1, Artist A, 1 liked song' })
    expect(link.querySelector<HTMLElement>('[data-slot="bar"]')?.style.width).toBe(`${barWidthPercent(1, 4)}%`)
  })

  it('shows an empty state when there are no rankings', async () => {
    renderWithRouter(<RankedArtistList rankings={[]} leaderCount={0} mode="all" />)

    expect(await screen.findByText('No liked songs')).toBeDefined()
    expect(screen.queryByRole('list')).toBeNull()
  })
})

describe('RankedArtistList keyboard navigation', () => {
  it('moves focus to the next and previous row with the arrow keys', async () => {
    const user = userEvent.setup()
    renderWithRouter(<RankedArtistList rankings={manyRankings()} leaderCount={1} mode="all" />)
    await screen.findAllByRole('listitem')

    await user.tab()
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
    renderWithRouter(<RankedArtistList rankings={manyRankings()} leaderCount={1} mode="all" />)
    await screen.findAllByRole('listitem')
    await user.tab()

    await user.keyboard('{End}')
    await waitFor(() => expect(focusedPosition()).toBe(String(ROW_COUNT)))
    expect(scrollTo).toHaveBeenCalled()

    await user.keyboard('{Home}')
    await waitFor(() => expect(focusedPosition()).toBe('1'))
  })

  it('lets Tab leave the list after one row instead of stepping through every row', async () => {
    const user = userEvent.setup()
    renderWithRouter(
      <>
        <RankedArtistList rankings={manyRankings()} leaderCount={1} mode="all" />
        <button type="button">After the list</button>
      </>,
    )
    await screen.findAllByRole('listitem')

    await user.tab()
    expect(focusedPosition()).toBe('1')
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'After the list' }))
  })

  it('ignores arrow keys when focus is outside the list', async () => {
    const user = userEvent.setup()
    renderWithRouter(
      <>
        <button type="button">Before the list</button>
        <RankedArtistList rankings={manyRankings()} leaderCount={1} mode="all" />
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
    renderWithRouter(<RankedArtistList rankings={manyRankings()} leaderCount={1} mode="all" />)
    await screen.findAllByRole('listitem')

    await act(async () => {
      scrollWindowTo(ROW_HEIGHT * 1_000)
    })

    const tabbable = screen.getAllByRole('link').filter((link) => link.getAttribute('tabindex') === '0')
    expect(tabbable).toHaveLength(1)
  })
})
