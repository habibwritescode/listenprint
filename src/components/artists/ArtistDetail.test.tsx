// @vitest-environment jsdom
import { act, cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ArtistRanking, ArtistRef, Library, LibraryTrack } from '../../library/types.ts'
import { makeArtist, makeTrack } from '../../test/factories.ts'
import { renderWithRouter } from '../../test/render-with-router.ts'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { ArtistHeader } from './ArtistHeader.tsx'
import { ArtistStats } from './ArtistStats.tsx'
import { FeaturedOnlyNotice } from './FeaturedOnlyNotice.tsx'
import { artistKicker, noSpotifyLinkNote } from './artist-format.ts'
import { ArtistTrackList } from './ArtistTrackList.tsx'

const TRACK_ROW_HEIGHT = 75

function scrollWindowTo(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
  window.dispatchEvent(new Event('scroll'))
}

afterEach(() => {
  cleanup()
  scrollWindowTo(0)
  vi.unstubAllGlobals()
})

function rankingFor(artist: ArtistRef, rank: number, count: number): ArtistRanking {
  return { artist, rank, count, tracks: Array.from({ length: count }, () => makeTrack({ artists: [artist] })) }
}

function positions() {
  return screen.getAllByRole('listitem').map((item) => Number(item.getAttribute('aria-posinset')))
}

describe('artistKicker', () => {
  const artist = makeArtist({ name: 'Pale Oxbow' })

  it('places the artist in the library, naming the library when given', () => {
    const ranking = rankingFor(artist, 1, 3)
    expect(artistKicker({ ranking, tied: false, artistCount: 1_412, library: 'Sample library' })).toBe(
      'Sample library · Ranked 1st of 1,412',
    )
    expect(artistKicker({ ranking: rankingFor(artist, 2, 3), tied: true, artistCount: 30 })).toBe('Tied 2nd of 30')
  })

  it('says why an artist without a ranking in this mode has none', () => {
    expect(artistKicker({ ranking: null, tied: false, artistCount: 30 })).toBe(
      'Not ranked while counting primary artists only',
    )
  })
})

describe('noSpotifyLinkNote', () => {
  it('explains a missing link for sample and local-file artists', () => {
    expect(noSpotifyLinkNote(makeArtist({ id: 'seed-1' }), 'demo')).toBe('Sample artist — no Spotify page')
    expect(noSpotifyLinkNote(makeArtist({ id: 'local:Garage Demos' }), 'spotify')).toBe(
      'No Spotify page — local files only',
    )
  })
})

describe('ArtistHeader', () => {
  const artist = makeArtist({ id: 'artist-a', name: 'Pale Oxbow' })

  it('shows the kicker and the name', async () => {
    renderWithRouter(<ArtistHeader artist={artist} kicker="Tied 2nd of 30" spotifyUrl={null} noLinkNote="No link" />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Pale Oxbow' })).toBeDefined()
    expect(screen.getByText('Tied 2nd of 30')).toBeDefined()
  })

  it('states why there is no Spotify link instead of showing a dead one', async () => {
    renderWithRouter(
      <ArtistHeader artist={artist} kicker="k" spotifyUrl={null} noLinkNote="Sample artist — no Spotify page" />,
    )

    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByText('Sample artist — no Spotify page')).toBeDefined()
    expect(screen.queryByRole('link', { name: /spotify/i })).toBeNull()
  })

  it('opens the artist in Spotify in a new tab when there is a URL', async () => {
    const url = 'https://open.spotify.com/artist/artist-a'
    renderWithRouter(<ArtistHeader artist={artist} kicker="k" spotifyUrl={url} noLinkNote="unused" />)

    const link = await screen.findByRole('link', { name: 'Open in Spotify' })
    expect(link.getAttribute('href')).toBe(url)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
    expect(screen.queryByText('unused')).toBeNull()
  })
})

describe('ArtistStats', () => {
  it('shows saved tracks, share of library, primary credits and the first like', async () => {
    const { container } = renderWithRouter(
      <ArtistStats savedTracks={318} share={0.0318} asPrimary={204} firstLiked="2019-04" />,
    )

    await screen.findByText('Saved tracks', { selector: 'dt' })
    const value = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent
    expect(value('Saved tracks')).toBe('318')
    expect(value('Share of library')).toBe('3.18%')
    expect(value('As primary')).toBe('204')
    expect(value('First liked')).toBe('2019-04')
    await expectNoAxeViolations(container)
  })
})

describe('FeaturedOnlyNotice', () => {
  it('explains the empty page and switches to all artists on the same artist, keeping the sort', async () => {
    const artist = makeArtist({ id: 'artist-a', name: 'Odile Ravel' })

    renderWithRouter(<FeaturedOnlyNotice artist={artist} savedTracks={26} sort="alpha" basePath="/demo" />)

    const title = 'Nothing to show in “primary artist only”'
    expect(await screen.findByRole('heading', { level: 2, name: title })).toBeDefined()
    expect(screen.getByText(/Every one of Odile Ravel’s 26 saved tracks is a featured credit/)).toBeDefined()
    expect(screen.getByRole('link', { name: 'Switch to all artists' }).getAttribute('href')).toBe(
      '/demo/artist/artist-a?mode=all&sort=alpha',
    )
    expect(screen.getByRole('link', { name: 'Back to ranking' }).getAttribute('href')).toBe(
      '/demo?mode=primary&sort=alpha',
    )
  })
})

const likedDateFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

/** A controllable `matchMedia`, since jsdom has none: `setMatches` fires the change listeners like a resize would. */
function stubMatchMedia(initial: boolean) {
  let matches = initial
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() {
      return matches
    },
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }))
  return (next: boolean) => {
    matches = next
    for (const listener of listeners) listener()
  }
}

function rowHeights() {
  return screen.getAllByRole('listitem').map((item) => item.style.height)
}

describe('FeaturedOnlyNotice on a live library', () => {
  it('links to the live artist page and ranking', async () => {
    const artist = makeArtist({ id: 'artist-a', name: 'Odile Ravel' })

    renderWithRouter(<FeaturedOnlyNotice artist={artist} savedTracks={2} sort="count" basePath="/" />)

    expect((await screen.findByRole('link', { name: 'Switch to all artists' })).getAttribute('href')).toBe(
      '/artist/artist-a?mode=all&sort=count',
    )
    expect(screen.getByRole('link', { name: 'Back to ranking' }).getAttribute('href')).toBe('/?mode=primary&sort=count')
  })
})

describe('ArtistTrackList', () => {
  const lead = makeArtist({ id: 'lead', name: 'Pale Oxbow' })
  const feature = makeArtist({ id: 'feature', name: 'Juniper Static' })
  const guest = makeArtist({ id: 'guest', name: 'Mira Duarte' })

  function renderTracks(tracks: LibraryTrack[], source: Library['source'] = 'demo') {
    return renderWithRouter(<ArtistTrackList tracks={tracks} artistId="lead" artistName="Pale Oxbow" source={source} />)
  }

  it('shows each track with its title, the other credited artists, and the UTC liked date', async () => {
    const track = makeTrack({ name: 'Low Orbit', artists: [lead, feature, guest], addedAt: '2026-03-01T00:30:00.000Z' })

    renderTracks([track])

    const list = await screen.findByRole('list', { name: 'Liked songs by Pale Oxbow' })
    const [row] = within(list).getAllByRole('listitem')
    expect(within(row).getByText('Low Orbit')).toBeDefined()
    expect(within(row).getByText('with Juniper Static, Mira Duarte')).toBeDefined()
    const dates = [...row.querySelectorAll('time')]
    expect(dates.length).toBeGreaterThan(0)
    for (const date of dates) {
      expect(date.textContent).toBe(likedDateFormat.format(new Date(track.addedAt)))
      expect(date.getAttribute('dateTime')).toBe(track.addedAt)
    }
  })

  it('names the section, says dates are UTC, and has no Spotify links on sample data', async () => {
    renderTracks([makeTrack({ artists: [lead] })])

    expect(await screen.findByRole('heading', { level: 2, name: 'Saved tracks' })).toBeDefined()
    expect(screen.getByText('Dates shown in UTC')).toBeDefined()
    expect(screen.getByText('Sample library — no album art')).toBeDefined()
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('opens each Spotify track in a new tab from a named action, with none for local files', async () => {
    const tracks = [
      makeTrack({ id: '6rqhFgbbKwnb9MLmUQDhG6', name: 'Low Orbit', artists: [lead] }),
      makeTrack({ id: 'local:::Garage:Demo:180', name: 'Garage Demo', artists: [lead] }),
    ]
    const { container } = renderTracks(tracks, 'spotify')

    const link = await screen.findByRole('link', { name: 'Open Low Orbit in Spotify — opens in a new tab' })
    expect(link.getAttribute('href')).toBe('https://open.spotify.com/track/6rqhFgbbKwnb9MLmUQDhG6')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
    expect(screen.queryByRole('link', { name: /Garage Demo/ })).toBeNull()
    expect(screen.getByText('Dates shown in UTC · ↗ opens the track in Spotify in a new tab')).toBeDefined()
    await expectNoAxeViolations(container)
  })

  it('moves between track actions with the arrow keys, as one Tab stop', async () => {
    const user = userEvent.setup()
    const tracks = ['7aaaaaaaaaaaaaaaaaaaaa', '7bbbbbbbbbbbbbbbbbbbbb', '7ccccccccccccccccccccc'].map((id) =>
      makeTrack({ id, artists: [lead] }),
    )
    renderWithRouter(
      <>
        <ArtistTrackList tracks={tracks} artistId="lead" artistName="Pale Oxbow" source="spotify" />
        <button type="button">After the list</button>
      </>,
    )
    await screen.findAllByRole('listitem')

    await user.tab()
    expect(document.activeElement?.closest('[aria-posinset]')?.getAttribute('aria-posinset')).toBe('1')
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(document.activeElement?.closest('[aria-posinset]')?.getAttribute('aria-posinset')).toBe('3')
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'After the list' }))
  })

  // Local files have no link, so the list's one Tab stop must land on a row that has one.
  it('keeps the list reachable with Tab when the first rows are local files', async () => {
    const user = userEvent.setup()
    const tracks = [
      makeTrack({ id: 'local:::Garage:Demo:180', artists: [lead] }),
      makeTrack({ id: '7bbbbbbbbbbbbbbbbbbbbb', name: 'Second Song', artists: [lead] }),
    ]
    renderTracks(tracks, 'spotify')
    await screen.findAllByRole('listitem')

    await user.tab()

    expect(document.activeElement).toBe(
      screen.getByRole('link', { name: 'Open Second Song in Spotify — opens in a new tab' }),
    )
  })

  it('adds an Album column, with album-letter tiles, when tracks have album names', async () => {
    const tracks = [
      makeTrack({ name: 'Low Orbit', albumName: 'Common Weather', artists: [lead] }),
      makeTrack({ name: 'Wide Glass', albumName: null, artists: [lead] }),
    ]
    const { container } = renderTracks(tracks, 'spotify')

    const [withAlbum, withoutAlbum] = await screen.findAllByRole('listitem')
    expect(container.querySelector('[data-slot="track-columns"]')?.textContent).toContain('Album')
    expect(within(withAlbum).getAllByText('Common Weather').length).toBeGreaterThan(0)
    expect(withAlbum.querySelector('[data-slot="art"]')?.textContent).toBe('C')
    expect(withoutAlbum.querySelector('[data-slot="art"]')?.textContent).toBe('W')
  })

  it('has no Album column when no track has an album name', async () => {
    const { container } = renderTracks([makeTrack({ artists: [lead] })])

    await screen.findAllByRole('listitem')
    expect(container.querySelector('[data-slot="track-columns"]')?.textContent).not.toContain('Album')
  })

  it('paints album art over the letter tile when there is any', async () => {
    const tracks = [
      makeTrack({ artists: [lead], albumImageUrl: 'https://i.scdn.co/image/abc' }),
      makeTrack({ artists: [lead] }),
    ]
    const { container } = renderTracks(tracks, 'spotify')

    await screen.findAllByRole('listitem')
    const images = container.querySelectorAll('img')
    expect(images).toHaveLength(1)
    expect(images[0].getAttribute('src')).toBe('https://i.scdn.co/image/abc')
    expect(images[0].getAttribute('alt')).toBe('')
  })

  // The virtualizer's fixed row height has to follow the breakpoint, or rows overlap or leave gaps after a resize.
  it('uses 64px rows at 741px and wider, 75px below, and re-measures when the width crosses', async () => {
    const setWide = stubMatchMedia(true)
    renderTracks(Array.from({ length: 5 }, () => makeTrack({ artists: [lead] })))

    await screen.findAllByRole('listitem')
    expect(new Set(rowHeights())).toEqual(new Set(['64px']))

    await act(async () => {
      setWide(false)
    })

    expect(new Set(rowHeights())).toEqual(new Set(['75px']))
  })

  it('renders only a window of rows, each with its position in the full list', async () => {
    const tracks = Array.from({ length: 2_000 }, () => makeTrack())

    renderTracks(tracks)

    const items = await screen.findAllByRole('listitem')
    expect(items.length).toBeGreaterThan(0)
    expect(items.length).toBeLessThan(tracks.length)
    expect(items.every((item) => item.getAttribute('aria-setsize') === String(tracks.length))).toBe(true)
    expect(positions()[0]).toBe(1)
  })

  // Fails if the 'use no memo' directive is removed: compiled, the virtualizer's rows never update.
  it('renders later rows after the window scrolls', async () => {
    renderTracks(Array.from({ length: 2_000 }, () => makeTrack()))
    await screen.findAllByRole('listitem')
    const before = positions()

    await act(async () => {
      scrollWindowTo(TRACK_ROW_HEIGHT * 1_000)
    })

    expect(Math.min(...positions())).toBeGreaterThan(Math.max(...before))
  })
})
