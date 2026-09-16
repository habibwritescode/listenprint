// @vitest-environment jsdom
import { act, cleanup, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ArtistRanking, ArtistRef } from '../../library/types.ts'
import { makeArtist, makeTrack } from '../../test/factories.ts'
import { renderWithRouter } from '../../test/render-with-router.ts'
import { ArtistHeader } from './ArtistHeader.tsx'
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

describe('ArtistHeader', () => {
  const artist = makeArtist({ id: 'artist-a', name: 'Pale Oxbow' })

  it('shows the name, rank, and liked song count', async () => {
    renderWithRouter(<ArtistHeader artist={artist} ranking={rankingFor(artist, 3, 2)} spotifyUrl={null} />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Pale Oxbow' })).toBeDefined()
    expect(screen.getByText('#3 · 2 liked songs')).toBeDefined()
  })

  it('uses the singular for one liked song', async () => {
    renderWithRouter(<ArtistHeader artist={artist} ranking={rankingFor(artist, 12, 1)} spotifyUrl={null} />)

    expect(await screen.findByText('#12 · 1 liked song')).toBeDefined()
  })

  it('has no Spotify link without a Spotify URL', async () => {
    renderWithRouter(<ArtistHeader artist={artist} ranking={rankingFor(artist, 1, 2)} spotifyUrl={null} />)

    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('link', { name: /spotify/i })).toBeNull()
  })

  it('opens the artist in Spotify in a new tab when there is a URL', async () => {
    const url = 'https://open.spotify.com/artist/artist-a'
    renderWithRouter(<ArtistHeader artist={artist} ranking={rankingFor(artist, 1, 2)} spotifyUrl={url} />)

    const link = await screen.findByRole('link', { name: 'Open in Spotify' })
    expect(link.getAttribute('href')).toBe(url)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
  })

  it('explains an artist not counted in this mode and links to the same artist with every credit counted', async () => {
    renderWithRouter(<ArtistHeader artist={artist} ranking={null} spotifyUrl={null} />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Pale Oxbow' })).toBeDefined()
    expect(screen.getByText(/only credited as a featured artist/)).toBeDefined()
    expect(screen.queryByText(/liked song/)).toBeNull()
    const switchLink = screen.getByRole('link', { name: 'Count every credited artist' })
    expect(switchLink.getAttribute('href')?.startsWith('/demo/artist/artist-a')).toBe(true)
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
