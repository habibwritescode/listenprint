import { beforeAll, describe, expect, it } from 'vitest'
import { artistTracks, rankArtists } from '../library/rankings.ts'
import type { Library, LibraryTrack } from '../library/types.ts'
import { generateDemoLibrary } from './generate.ts'

function distinctArtistIds(track: LibraryTrack): string[] {
  return [...new Set(track.artists.map((artist) => artist.id))]
}

describe('demo library realism', () => {
  let library: Library

  beforeAll(() => {
    library = generateDemoLibrary()
  })

  it('has a long tail: a few heavy artists and many liked once', () => {
    const ranked = rankArtists(library.tracks, 'primary')
    const total = library.tracks.length
    const topShare = ranked[0].count / total
    const topTenShare = ranked.slice(0, 10).reduce((sum, r) => sum + r.count, 0) / total
    const singletonShare = ranked.filter((r) => r.count === 1).length / ranked.length

    expect(topShare).toBeGreaterThanOrEqual(0.02)
    expect(topShare).toBeLessThanOrEqual(0.06)
    expect(topTenShare).toBeGreaterThanOrEqual(0.15)
    expect(topTenShare).toBeLessThanOrEqual(0.3)
    expect(singletonShare).toBeGreaterThanOrEqual(0.35)
  })

  it('credits 12–20% of tracks to more than one artist', () => {
    const featured = library.tracks.filter((track) => distinctArtistIds(track).length >= 2)

    expect(featured.length / library.tracks.length).toBeGreaterThanOrEqual(0.12)
    expect(featured.length / library.tracks.length).toBeLessThanOrEqual(0.2)
  })

  it('ranks differently by mode: at least 3 of the all-mode top 25 are outside the primary top 25', () => {
    const topIds = (mode: 'all' | 'primary') =>
      new Set(rankArtists(library.tracks, mode).slice(0, 25).map((r) => r.artist.id))
    const primaryTop = topIds('primary')

    expect([...topIds('all')].filter((id) => !primaryTop.has(id)).length).toBeGreaterThanOrEqual(3)
  })

  it.each(['all', 'primary'] as const)('shows no repeated first word among the top 10 in %s mode', (mode) => {
    const firstWords = rankArtists(library.tracks, mode)
      .slice(0, 10)
      .map((r) => r.artist.name.split(' ')[0].toLowerCase())

    expect(new Set(firstWords).size).toBe(10)
  })

  it('has at least 10 artist pairs credited together on 3 or more tracks', () => {
    const pairCounts = new Map<string, number>()
    for (const track of library.tracks) {
      const ids = distinctArtistIds(track).sort()
      for (let i = 0; i < ids.length; i += 1) {
        for (let j = i + 1; j < ids.length; j += 1) {
          const key = `${ids[i]}|${ids[j]}`
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
        }
      }
    }

    expect([...pairCounts.values()].filter((count) => count >= 3).length).toBeGreaterThanOrEqual(10)
  })

  it('has exactly one track that lists the same artist twice', () => {
    const duplicated = library.tracks.filter((track) => distinctArtistIds(track).length < track.artists.length)

    expect(duplicated).toHaveLength(1)
  })

  it.each(['all', 'primary'] as const)('agrees with artistTracks for the top 50 artists in %s mode', (mode) => {
    for (const ranking of rankArtists(library.tracks, mode).slice(0, 50)) {
      expect(artistTracks(library.tracks, ranking.artist.id, mode)).toEqual(ranking.tracks)
    }
  })
})
