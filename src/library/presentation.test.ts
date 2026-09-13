import { describe, expect, it } from 'vitest'
import { makeArtist, makeTrack } from '../test/factories.ts'
import { artistInitial, barWidthPercent, libraryStats, spotifyArtistUrl } from './presentation.ts'
import { rankArtists } from './rankings.ts'

describe('libraryStats', () => {
  it('counts tracks, ranked artists, and the leader count', () => {
    const artistA = makeArtist({ id: 'a' })
    const tracks = [
      makeTrack({ artists: [artistA, makeArtist()] }),
      makeTrack({ artists: [artistA] }),
      makeTrack({ artists: [makeArtist()] }),
    ]

    const stats = libraryStats(rankArtists(tracks, 'all'), tracks)

    expect(stats).toEqual({ trackCount: 3, artistCount: 3, leaderCount: 2 })
  })

  it('returns zeros for an empty library', () => {
    expect(libraryStats([], [])).toEqual({ trackCount: 0, artistCount: 0, leaderCount: 0 })
  })
})

describe('barWidthPercent', () => {
  it('gives the leader a full bar', () => {
    expect(barWidthPercent(40, 40)).toBe(100)
  })

  it('scales other counts against the leader', () => {
    expect(barWidthPercent(20, 40)).toBe(50)
  })

  it('keeps small counts visible with a 4% floor', () => {
    expect(barWidthPercent(1, 1_000)).toBe(4)
  })

  it('never exceeds a full bar', () => {
    expect(barWidthPercent(5, 2)).toBe(100)
  })

  it('returns 0 when there is no leader count', () => {
    expect(barWidthPercent(3, 0)).toBe(0)
  })
})

describe('artistInitial', () => {
  it('uppercases the first letter', () => {
    expect(artistInitial('emile rowe')).toBe('E')
  })

  it('keeps accented letters, including decomposed ones', () => {
    expect(artistInitial('Émile Rowe')).toBe('É')
    expect(artistInitial('Émile Rowe')).toBe('É')
  })

  it('skips leading symbols, digits, and emoji', () => {
    expect(artistInitial('#1 Crew')).toBe('C')
    expect(artistInitial('4ever Club')).toBe('E')
    expect(artistInitial('🎧 beats')).toBe('B')
  })

  it('keeps a letter whose uppercase form is more than one character', () => {
    expect(artistInitial('ßeta')).toBe('ß')
  })

  it.each(['', '123', '!!!'])('falls back to # for %j, which has no letter', (name) => {
    expect(artistInitial(name)).toBe('#')
  })
})

describe('spotifyArtistUrl', () => {
  it('links a Spotify artist to open.spotify.com', () => {
    const artist = makeArtist({ id: '4Z8W4fKeB5YxbusRsdQVPb' })

    expect(spotifyArtistUrl(artist, 'spotify')).toBe('https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb')
  })

  it('has no link for demo artists', () => {
    expect(spotifyArtistUrl(makeArtist({ id: '4Z8W4fKeB5YxbusRsdQVPb' }), 'demo')).toBeNull()
  })

  it('has no link for local-file artists', () => {
    expect(spotifyArtistUrl(makeArtist({ id: 'local:Garage Demos' }), 'spotify')).toBeNull()
  })
})
