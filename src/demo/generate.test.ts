import { beforeAll, describe, expect, it } from 'vitest'
import type { Library } from '../library/types.ts'
import { DEMO_FETCHED_AT, DEMO_SEED, DEMO_TRACK_COUNT, buildRoster, generateDemoLibrary } from './generate.ts'
import type { Roster, RosterArtist } from './generate.ts'
import { createRandom } from './random.ts'
import { GENRE_CLUSTERS } from './vocabulary.ts'

const nameCollator = new Intl.Collator('en', { sensitivity: 'base' })
const allGenres = new Set<string>(Object.values(GENRE_CLUSTERS).flat())

describe('buildRoster', () => {
  let roster: Roster
  let artists: RosterArtist[]

  beforeAll(() => {
    roster = buildRoster(createRandom(DEMO_SEED))
    artists = [...roster.core, ...roster.tail]
  })

  it('builds the same roster for the same seed', () => {
    expect(buildRoster(createRandom(DEMO_SEED))).toEqual(roster)
  })

  it('has a long tail larger than the core', () => {
    expect(roster.core.length).toBeGreaterThan(0)
    expect(roster.tail.length).toBeGreaterThan(roster.core.length)
    expect(roster.core.every((artist) => artist.tier === 'core')).toBe(true)
    expect(roster.tail.every((artist) => artist.tier === 'tail')).toBe(true)
  })

  it('gives every artist a unique 22-character base62 id', () => {
    const ids = artists.map((artist) => artist.id)

    expect(ids.every((id) => /^[0-9A-Za-z]{22}$/.test(id))).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('never reuses an exact name', () => {
    const names = artists.map((artist) => artist.name)

    expect(new Set(names).size).toBe(names.length)
  })

  it('includes distinct artists whose names differ only by accent or case', () => {
    const variantPair = artists.some((a, i) =>
      artists.some((b, j) => j > i && a.id !== b.id && nameCollator.compare(a.name, b.name) === 0),
    )

    expect(variantPair).toBe(true)
  })

  it('includes a name that starts with a lowercase letter', () => {
    expect(artists.some((artist) => /^\p{Ll}/u.test(artist.name))).toBe(true)
  })

  // The top of the ranking is what screenshots show.
  it('gives the 25 most popular core artists distinct first words', () => {
    const firstWords = roster.core
      .slice(0, 25)
      .map((artist) => artist.name.split(' ')[0].normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase())

    expect(new Set(firstWords).size).toBe(25)
  })

  it('classifies at least 85% of artists with 1–3 genres from their own cluster', () => {
    const classified = artists.filter((artist) => artist.genres.length > 0)

    expect(classified.length / artists.length).toBeGreaterThanOrEqual(0.85)
    for (const artist of artists) {
      expect(artist.genres.length).toBeLessThanOrEqual(3)
      expect(new Set(artist.genres).size).toBe(artist.genres.length)
      for (const genre of artist.genres) {
        expect(allGenres.has(genre)).toBe(true)
        expect(GENRE_CLUSTERS[artist.cluster]).toContain(genre)
      }
    }
  })

  it('pairs recurring collaborators from the core within one genre cluster', () => {
    const keys = roster.pairs.map(([a, b]) => [a.id, b.id].sort().join('|'))

    expect(roster.pairs.length).toBeGreaterThan(0)
    expect(new Set(keys).size).toBe(keys.length)
    for (const [a, b] of roster.pairs) {
      expect(a.id).not.toBe(b.id)
      expect(a.tier).toBe('core')
      expect(b.tier).toBe('core')
      expect(a.cluster).toBe(b.cluster)
    }
  })

  it('marks some core artists as feature-heavy and no tail artists', () => {
    expect(roster.core.some((artist) => artist.featureHeavy)).toBe(true)
    expect(roster.tail.some((artist) => artist.featureHeavy)).toBe(false)
  })
})

describe('generateDemoLibrary', () => {
  let library: Library

  beforeAll(() => {
    library = generateDemoLibrary()
  })

  const monthOf = (iso: string) => iso.slice(0, 7)

  describe('determinism and size', () => {
    it('returns an identical library for the same seed', () => {
      expect(generateDemoLibrary({ seed: DEMO_SEED })).toEqual(library)
    })

    it('returns different tracks for a different seed', () => {
      const other = generateDemoLibrary({ seed: DEMO_SEED + 1, trackCount: 50 })

      expect(other.tracks.map((t) => t.id)).not.toEqual(generateDemoLibrary({ trackCount: 50 }).tracks.map((t) => t.id))
    })

    it('pins the newest three tracks of the default library', () => {
      expect(library.tracks.slice(0, 3)).toMatchInlineSnapshot(`
        [
          {
            "addedAt": "2026-08-31T13:30:01.626Z",
            "albumImageUrl": null,
            "albumName": null,
            "artists": [
              {
                "id": "KUTqztguNSZ8uFQg2sAN3z",
                "name": "Isolde Beaumont",
              },
            ],
            "id": "BeKeb9YUYrYyLNZsVxcFCi",
            "name": "Paperweight (Reprise)",
          },
          {
            "addedAt": "2026-08-31T09:23:25.217Z",
            "albumImageUrl": null,
            "albumName": null,
            "artists": [
              {
                "id": "PqKCEHywqS1pKeMpRwoCKs",
                "name": "Gilded Lanterns",
              },
              {
                "id": "jLa2gAgM1g5Fd6YQ2diXoT",
                "name": "Dario Hollis",
              },
            ],
            "id": "z6bPQuFYDi6sIUzY5DV6fb",
            "name": "Night Bus Part II",
          },
          {
            "addedAt": "2026-08-30T23:05:07.875Z",
            "albumImageUrl": null,
            "albumName": null,
            "artists": [
              {
                "id": "TzWQk7NqbZ2bw0otJxBUNV",
                "name": "Priya Ashby",
              },
            ],
            "id": "idrOYfc9EcWrg4NFVcGrrN",
            "name": "Paperweight",
          },
        ]
      `)
    })

    it(`defaults to ${DEMO_TRACK_COUNT} tracks`, () => {
      expect(library.tracks).toHaveLength(DEMO_TRACK_COUNT)
    })

    it.each([0, 1, 50, 20_000])('returns exactly %i tracks when asked', (trackCount) => {
      expect(generateDemoLibrary({ trackCount }).tracks).toHaveLength(trackCount)
    })

    it.each([2.5, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects a track count of %s', (trackCount) => {
      expect(() => generateDemoLibrary({ trackCount })).toThrow(RangeError)
    })
  })

  describe('contract', () => {
    it('is a demo library with a fixed fetch time', () => {
      expect(library.source).toBe('demo')
      expect(library.fetchedAt).toBe(DEMO_FETCHED_AT)
    })

    it('produces tracks that satisfy the Library contract', () => {
      for (const track of library.tracks) {
        expect(track.name.length).toBeGreaterThan(0)
        expect(track.albumName).toBeNull()
        expect(track.albumImageUrl).toBeNull()
        expect(new Date(track.addedAt).toISOString()).toBe(track.addedAt)
        expect(track.artists.length).toBeGreaterThanOrEqual(1)
        for (const artist of track.artists) {
          expect(Object.keys(artist).sort()).toEqual(['id', 'name'])
          expect(artist.name.length).toBeGreaterThan(0)
        }
      }
    })

    it('survives a JSON round trip unchanged', () => {
      expect(JSON.parse(JSON.stringify(library))).toEqual(library)
    })

    it('gives every track a unique id and never maps one artist id to two names', () => {
      const trackIds = library.tracks.map((track) => track.id)
      const namesById = new Map<string, Set<string>>()
      for (const artist of library.tracks.flatMap((track) => track.artists)) {
        namesById.set(artist.id, (namesById.get(artist.id) ?? new Set()).add(artist.name))
      }

      expect(new Set(trackIds).size).toBe(trackIds.length)
      expect([...namesById.values()].every((names) => names.size === 1)).toBe(true)
    })
  })

  describe('timeline', () => {
    it('orders tracks newest first between March 2019 and the fetch time', () => {
      const times = library.tracks.map((track) => Date.parse(track.addedAt))

      expect(times.every((time, i) => i === 0 || time <= times[i - 1])).toBe(true)
      expect(Math.min(...times)).toBeGreaterThanOrEqual(Date.parse('2019-03-01T00:00:00.000Z'))
      expect(Math.max(...times)).toBeLessThanOrEqual(Date.parse(DEMO_FETCHED_AT))
    })

    it('spans at least 60 months with at least one binge month', () => {
      const perMonth = new Map<string, number>()
      for (const track of library.tracks) {
        perMonth.set(monthOf(track.addedAt), (perMonth.get(monthOf(track.addedAt)) ?? 0) + 1)
      }
      const counts = [...perMonth.values()].sort((a, b) => a - b)
      const median = counts[Math.floor(counts.length / 2)]

      expect(perMonth.size).toBeGreaterThanOrEqual(60)
      expect(counts.at(-1)).toBeGreaterThanOrEqual(2.5 * median)
    })
  })

  describe('local files', () => {
    it('includes 8–16 local files credited to local artists', () => {
      const localTracks = library.tracks.filter((track) => track.id.startsWith('local:'))

      expect(localTracks.length).toBeGreaterThanOrEqual(8)
      expect(localTracks.length).toBeLessThanOrEqual(16)
      for (const track of localTracks) {
        expect(track.artists.every((artist) => artist.id === `local:${artist.name}`)).toBe(true)
      }
    })

    it('has a local artist sharing its name with a catalog artist', () => {
      const artists = library.tracks.flatMap((track) => track.artists)
      const catalogNames = new Set(artists.filter((a) => !a.id.startsWith('local:')).map((a) => a.name))

      expect(artists.some((a) => a.id.startsWith('local:') && catalogNames.has(a.name))).toBe(true)
    })
  })
})
