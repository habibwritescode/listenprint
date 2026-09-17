import type { ArtistRef, Library, LibraryTrack } from '../library/types.ts'
import { createRandom, cumulative, zipfWeights } from './random.ts'
import type { Random } from './random.ts'
import {
  BAND_ADJECTIVES,
  BAND_NOUNS,
  FIRST_NAMES,
  GENRE_CLUSTERS,
  LAST_NAMES,
  TITLE_SUFFIXES,
  TITLE_WORDS,
  VARIANT_ARTIST_NAMES,
} from './vocabulary.ts'
import type { GenreCluster } from './vocabulary.ts'

export const DEMO_SEED = 20260913
export const DEMO_TRACK_COUNT = 10_000
/** A fixed timestamp rather than the current time, so the generated library is identical on every load. */
export const DEMO_FETCHED_AT = '2026-09-01T12:00:00.000Z'

// Tuning knobs, not contracts: the realism tests define what must hold.
const CORE_ARTISTS = 450
const TAIL_ARTISTS = 1500
const RECURRING_PAIRS = 40
/** Pairs come from the top of the core so each one recurs often enough to notice. */
const PAIR_RANK_LIMIT = 100
const FEATURE_HEAVY_ARTISTS = 8
/** Feature-heavy artists come from below the top of the core, so they rise mainly in `all` mode. */
const FEATURE_HEAVY_MIN_RANK = 100
const UNCLASSIFIED_SHARE = 0.1
const LOWERCASE_NAME_CHANCE = 0.03
/** In VARIANT_ARTIST_NAMES order. */
const VARIANT_RANKS = [30, 31, 70, 71, 18] as const
const DISTINCT_LEADING_RANKS = 25

const CORE_ZIPF_EXPONENT = 0.7
const FEATURE_HEAVY_PRIMARY_MULTIPLIER = 0.15
const TAIL_PRIMARY_SHARE = 0.15
const TAIL_LIKED_TWICE_SHARE = 0.2
const COLLABORATOR_FEATURE_RATE = 0.25
const OTHER_TRACK_FEATURE_RATE = 0.12
const FEATURE_HEAVY_SHARE = 0.7
const SECOND_FEATURE_RATE = 0.2

const TIMELINE_START_YEAR = 2019
const TIMELINE_START_MONTH = 2 // March, 0-based
const TIMELINE_GROWTH = 1.5
const BINGE_WINDOWS = 4
const BINGE_MULTIPLIER = 3.5

const LOCAL_FILES = 12
const TRACKS_PER_LOCAL_FILE = 50
const LOCAL_ARTIST_NAMES = ['Unknown Artist', 'Garage Demos'] as const

const ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const CLUSTERS = Object.keys(GENRE_CLUSTERS) as GenreCluster[]

export interface RosterArtist extends ArtistRef {
  genres: readonly string[]
  cluster: GenreCluster
  tier: 'core' | 'tail'
  featureHeavy: boolean
}

export interface Roster {
  /** Ordered by popularity rank: index 0 is the most-liked artist. */
  core: RosterArtist[]
  tail: RosterArtist[]
  pairs: Array<readonly [RosterArtist, RosterArtist]>
}

export interface DemoLibraryOptions {
  seed?: number
  trackCount?: number
}

function spotifyLikeId(random: Random, used: Set<string>): string {
  let id: string
  do {
    id = ''
    for (let i = 0; i < 22; i += 1) id += ID_ALPHABET[random.int(0, ID_ALPHABET.length - 1)]
  } while (used.has(id))
  used.add(id)
  return id
}

/** Accent- and case-folded, so generated names never become accidental variants of each other. */
function baseNameKey(name: string): string {
  return name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

function candidateName(random: Random): string {
  const style = random.next()
  if (style < 0.4) return `${random.pick(BAND_ADJECTIVES)} ${random.pick(BAND_NOUNS)}`
  const person = `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`
  return style < 0.85 ? person : `${person} & the ${random.pick(BAND_NOUNS)}`
}

function uniqueNames(random: Random, count: number, reservedKeys: Set<string>): string[] {
  const names: string[] = []
  while (names.length < count) {
    const candidate = candidateName(random)
    const key = baseNameKey(candidate)
    if (reservedKeys.has(key)) continue
    reservedKeys.add(key)
    names.push(random.chance(LOWERCASE_NAME_CHANCE) ? candidate.toLowerCase() : candidate)
  }
  return names
}

/**
 * Moves later names forward so the most popular ranks never share a first word. Bigger word lists
 * alone can't prevent it: a seed's early draws can cluster on one index.
 */
export function spreadLeadingFirstWords(names: string[], ranks: number): void {
  const firstWordKey = (name: string) => baseNameKey(name.split(' ')[0])
  const seen = new Set<string>()
  for (let rank = 0; rank < Math.min(ranks, names.length); rank += 1) {
    if (seen.has(firstWordKey(names[rank]))) {
      const swap = names.findIndex((name, index) => index > rank && !seen.has(firstWordKey(name)))
      if (swap !== -1) [names[rank], names[swap]] = [names[swap], names[rank]]
    }
    seen.add(firstWordKey(names[rank]))
  }
}

function genresFor(random: Random, cluster: GenreCluster): string[] {
  if (random.chance(UNCLASSIFIED_SHARE)) return []
  const pool: string[] = [...GENRE_CLUSTERS[cluster]]
  const count = random.int(1, 3)
  return Array.from({ length: count }, () => pool.splice(random.int(0, pool.length - 1), 1)[0])
}

/** Internal: exported for tests until `analytics` defines the public genre shape. */
export function buildRoster(random: Random): Roster {
  const reservedKeys = new Set(VARIANT_ARTIST_NAMES.map(baseNameKey))
  const coreNames = uniqueNames(random, CORE_ARTISTS - VARIANT_ARTIST_NAMES.length, reservedKeys)
  spreadLeadingFirstWords(coreNames, DISTINCT_LEADING_RANKS)
  VARIANT_RANKS.forEach((rank, index) => coreNames.splice(rank, 0, VARIANT_ARTIST_NAMES[index]))
  const tailNames = uniqueNames(random, TAIL_ARTISTS, reservedKeys)

  const usedIds = new Set<string>()
  const makeArtist = (name: string, tier: RosterArtist['tier']): RosterArtist => {
    const cluster = random.pick(CLUSTERS)
    return {
      id: spotifyLikeId(random, usedIds),
      name,
      genres: genresFor(random, cluster),
      cluster,
      tier,
      featureHeavy: false,
    }
  }
  const core = coreNames.map((name) => makeArtist(name, 'core'))
  const tail = tailNames.map((name) => makeArtist(name, 'tail'))

  const featureHeavyRanks = new Set<number>()
  while (featureHeavyRanks.size < FEATURE_HEAVY_ARTISTS) {
    featureHeavyRanks.add(random.int(FEATURE_HEAVY_MIN_RANK, CORE_ARTISTS - 1))
  }
  for (const rank of featureHeavyRanks) core[rank].featureHeavy = true

  const coreByCluster = Object.fromEntries(CLUSTERS.map((cluster) => [cluster, [] as RosterArtist[]])) as Record<
    GenreCluster,
    RosterArtist[]
  >
  for (const artist of core) coreByCluster[artist.cluster].push(artist)
  const pairs: Array<readonly [RosterArtist, RosterArtist]> = []
  const pairKeys = new Set<string>()
  while (pairs.length < RECURRING_PAIRS) {
    const first = core[random.int(0, PAIR_RANK_LIMIT - 1)]
    const second = random.pick(coreByCluster[first.cluster].filter((artist) => artist.id !== first.id))
    const key = [first.id, second.id].sort().join('|')
    if (pairKeys.has(key)) continue
    pairKeys.add(key)
    pairs.push([first, second])
  }

  return { core, tail, pairs }
}

function toArtistRef(artist: ArtistRef): ArtistRef {
  return { id: artist.id, name: artist.name }
}

function distinctIndices(random: Random, bound: number, count: number): Set<number> {
  const indices = new Set<number>()
  while (indices.size < Math.min(count, bound)) indices.add(random.int(0, bound - 1))
  return indices
}

/** A shuffled queue rather than weighted draws, so most long-tail artists are liked exactly once. */
function tailQueue(random: Random, tail: readonly RosterArtist[]): RosterArtist[] {
  const queue = tail.flatMap((artist) => (random.chance(TAIL_LIKED_TWICE_SHARE) ? [artist, artist] : [artist]))
  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = random.int(0, i)
    ;[queue[i], queue[j]] = [queue[j], queue[i]]
  }
  return queue
}

function likedTimestamps(random: Random, count: number): string[] {
  const fetchedAt = new Date(DEMO_FETCHED_AT)
  const months =
    (fetchedAt.getUTCFullYear() - TIMELINE_START_YEAR) * 12 + fetchedAt.getUTCMonth() - TIMELINE_START_MONTH
  const weights = Array.from({ length: months }, (_, month) => 1 + (TIMELINE_GROWTH * month) / (months - 1))
  for (let window = 0; window < BINGE_WINDOWS; window += 1) {
    const start = random.int(0, months - 3)
    const length = random.int(1, 3)
    for (let month = start; month < start + length; month += 1) weights[month] *= BINGE_MULTIPLIER
  }
  const table = cumulative(weights)

  return Array.from({ length: count }, () => {
    const month = random.weightedIndex(table)
    const start = Date.UTC(TIMELINE_START_YEAR, TIMELINE_START_MONTH + month, 1)
    const end = Date.UTC(TIMELINE_START_YEAR, TIMELINE_START_MONTH + month + 1, 1)
    return start + Math.floor(random.next() * (end - start))
  })
    .sort((a, b) => a - b)
    .map((time) => new Date(time).toISOString())
}

function trackTitle(random: Random): string {
  return `${random.pick(TITLE_WORDS)} ${random.pick(TITLE_SUFFIXES)}`.trim()
}

function localTrack(random: Random, artistName: string, serial: number, addedAt: string): LibraryTrack {
  const name = `Voice Memo ${serial + 1}`
  const seconds = random.int(90, 320)
  const uri = `spotify:local:${encodeURIComponent(artistName)}::${encodeURIComponent(name)}:${seconds}`
  return {
    id: `local:${uri}`,
    name,
    addedAt,
    albumName: null,
    albumImageUrl: null,
    artists: [{ id: `local:${artistName}`, name: artistName }],
  }
}

export function generateDemoLibrary({
  seed = DEMO_SEED,
  trackCount = DEMO_TRACK_COUNT,
}: DemoLibraryOptions = {}): Library {
  // Fractions would leave a track without addedAt, and Infinity would never finish placing local files.
  if (!Number.isInteger(trackCount) || trackCount < 0) {
    throw new RangeError(`trackCount must be a non-negative integer, got ${trackCount}`)
  }
  const random = createRandom(seed)
  const roster = buildRoster(random)
  const usedIds = new Set([...roster.core, ...roster.tail].map((artist) => artist.id))

  const coreTable = cumulative(
    zipfWeights(roster.core.length, CORE_ZIPF_EXPONENT).map((weight, rank) =>
      roster.core[rank].featureHeavy ? weight * FEATURE_HEAVY_PRIMARY_MULTIPLIER : weight,
    ),
  )
  const featureHeavy = roster.core.filter((artist) => artist.featureHeavy)
  const collaborators = new Map<string, RosterArtist[]>()
  for (const [a, b] of roster.pairs) {
    collaborators.set(a.id, [...(collaborators.get(a.id) ?? []), b])
    collaborators.set(b.id, [...(collaborators.get(b.id) ?? []), a])
  }
  const tail = tailQueue(random, roster.tail)
  let tailCursor = 0
  const nextTailArtist = () => (tailCursor < tail.length ? tail[tailCursor++] : random.pick(roster.tail))

  const localIndices = distinctIndices(random, trackCount, Math.min(LOCAL_FILES, Math.floor(trackCount / TRACKS_PER_LOCAL_FILE)))
  let duplicateCreditIndex = Math.floor(trackCount / 2)
  while (localIndices.has(duplicateCreditIndex)) duplicateCreditIndex += 1
  const timestamps = likedTimestamps(random, trackCount)

  const chronological: LibraryTrack[] = []
  let localSerial = 0
  for (let index = 0; index < trackCount; index += 1) {
    if (localIndices.has(index)) {
      // Shares its artist name with the top catalog artist: the collision `local:` ids exist to keep apart.
      const artistName = localSerial === 0 ? roster.core[0].name : random.pick(LOCAL_ARTIST_NAMES)
      chronological.push(localTrack(random, artistName, localSerial, timestamps[index]))
      localSerial += 1
      continue
    }

    const primary = random.chance(TAIL_PRIMARY_SHARE) ? nextTailArtist() : roster.core[random.weightedIndex(coreTable)]
    const credits: RosterArtist[] = [primary]
    const addCredit = (artist: RosterArtist) => {
      if (!credits.includes(artist)) credits.push(artist)
    }
    const partners = collaborators.get(primary.id)
    if (partners && random.chance(COLLABORATOR_FEATURE_RATE)) {
      addCredit(random.pick(partners))
    } else if (random.chance(OTHER_TRACK_FEATURE_RATE)) {
      addCredit(random.chance(FEATURE_HEAVY_SHARE) ? random.pick(featureHeavy) : roster.core[random.weightedIndex(coreTable)])
    }
    if (credits.length > 1 && random.chance(SECOND_FEATURE_RATE)) {
      addCredit(roster.core[random.weightedIndex(coreTable)])
    }

    const artists = credits.map(toArtistRef)
    // Real Spotify data occasionally lists an artist twice on one track; `rankArtists` must count it once.
    if (index === duplicateCreditIndex) artists.push(toArtistRef(primary))

    chronological.push({
      id: spotifyLikeId(random, usedIds),
      name: trackTitle(random),
      addedAt: timestamps[index],
      albumName: null,
      albumImageUrl: null,
      artists,
    })
  }

  return { source: 'demo', fetchedAt: DEMO_FETCHED_AT, tracks: chronological.reverse() }
}
