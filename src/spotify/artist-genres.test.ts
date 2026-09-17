import { describe, expect, it } from 'vitest'
import { savedArtistGenres } from './artist-genres.ts'

const fetchedAt = Date.UTC(2026, 8, 1)

describe('savedArtistGenres', () => {
  it('keeps the tags of every artist Spotify answered for', () => {
    const genres = savedArtistGenres({
      'artist-1': { details: { id: 'artist-1', imageUrl: null, genres: ['dream pop'] }, fetchedAt },
      'artist-2': { details: { id: 'artist-2', imageUrl: null, genres: [] }, fetchedAt },
    })

    expect([...genres]).toEqual([
      ['artist-1', ['dream pop']],
      ['artist-2', []],
    ])
  })

  // A refused lookup is not the same as an artist Spotify has no tags for, and the pages say different things.
  it('leaves out artists whose lookup failed', () => {
    const genres = savedArtistGenres({ 'artist-3': { details: null, fetchedAt } })

    expect(genres.has('artist-3')).toBe(false)
  })

  it('has nothing before any lookup', () => {
    expect(savedArtistGenres(undefined).size).toBe(0)
  })
})
