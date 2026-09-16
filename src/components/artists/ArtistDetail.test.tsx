// @vitest-environment jsdom
import { act, cleanup, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ArtistRanking, ArtistRef } from '../../library/types.ts'
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

    renderWithRouter(<FeaturedOnlyNotice artist={artist} savedTracks={26} sort="alpha" />)

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

describe('ArtistTrackList', () => {
  it('shows each track with its title, every credited artist, and the UTC liked date', async () => {
    const lead = makeArtist({ name: 'Pale Oxbow' })
    const feature = makeArtist({ name: 'Juniper Static' })
    const track = makeTrack({ name: 'Low Orbit', artists: [lead, feature], addedAt: '2026-03-01T00:30:00.000Z' })
    const likedDate = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(track.addedAt))

    renderWithRouter(<ArtistTrackList tracks={[track]} artistName="Pale Oxbow" />)

    const list = await screen.findByRole('list', { name: 'Liked songs by Pale Oxbow' })
    const [row] = within(list).getAllByRole('listitem')
    expect(within(row).getByText('Low Orbit')).toBeDefined()
    expect(within(row).getByText('Pale Oxbow • Juniper Static')).toBeDefined()
    expect(row.querySelector('time')?.textContent).toBe(likedDate)
    expect(row.querySelector('time')?.getAttribute('dateTime')).toBe(track.addedAt)
  })

  it('renders only a window of rows, each with its position in the full list', async () => {
    const tracks = Array.from({ length: 2_000 }, () => makeTrack())

    renderWithRouter(<ArtistTrackList tracks={tracks} artistName="Pale Oxbow" />)

    const items = await screen.findAllByRole('listitem')
    expect(items.length).toBeGreaterThan(0)
    expect(items.length).toBeLessThan(tracks.length)
    expect(items.every((item) => item.getAttribute('aria-setsize') === String(tracks.length))).toBe(true)
    expect(positions()[0]).toBe(1)
  })

  // Fails if the 'use no memo' directive is removed: compiled, the virtualizer's rows never update.
  it('renders later rows after the window scrolls', async () => {
    renderWithRouter(<ArtistTrackList tracks={Array.from({ length: 2_000 }, () => makeTrack())} artistName="A" />)
    await screen.findAllByRole('listitem')
    const before = positions()

    await act(async () => {
      scrollWindowTo(TRACK_ROW_HEIGHT * 1_000)
    })

    expect(Math.min(...positions())).toBeGreaterThan(Math.max(...before))
  })
})
