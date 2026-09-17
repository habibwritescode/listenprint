import { isNonEmptyString, isRecord } from '../auth/guards.ts'
import type { ArtistDetails, ArtistRef, Library, LibraryTrack } from '../library/types.ts'

/** The pages read so far by a scan that hasn't finished, so it can resume where it stopped. */
export interface PartialScan {
  tracks: LibraryTrack[]
  nextOffset: number
  total: number
  /** ISO 8601 */
  startedAt: string
}

/** `details: null` records a failed lookup, so it isn't repeated until the next refresh. */
export interface SavedArtistDetails {
  details: ArtistDetails | null
  /** Epoch milliseconds. */
  fetchedAt: number
}

export interface LibraryStore {
  /** `false` for the memory fallback: the library won't outlive the tab. */
  readonly persistent: boolean
  loadLibrary(): Promise<Library | null>
  /** Replaces the library in one write and discards any partial scan, which a finished scan no longer needs. */
  saveLibrary(library: Library): Promise<void>
  loadPartialScan(): Promise<PartialScan | null>
  savePartialScan(scan: PartialScan): Promise<void>
  discardPartialScan(): Promise<void>
  loadArtistDetails(): Promise<Record<string, SavedArtistDetails>>
  saveArtistDetails(artistId: string, record: SavedArtistDetails): Promise<void>
  clear(): Promise<void>
}

/** Bumped when a saved shape changes; older records then load as nothing and the user rescans. */
export const RECORD_VERSION = 1

const isString = (value: unknown): value is string => typeof value === 'string'
const isNullableString = (value: unknown): value is string | null => value === null || isString(value)

function isArtistRef(value: unknown): value is ArtistRef {
  return isRecord(value) && isNonEmptyString(value.id) && isNonEmptyString(value.name)
}

function isTrack(value: unknown): value is LibraryTrack {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isString(value.name) &&
    isString(value.addedAt) &&
    isNullableString(value.albumName) &&
    isNullableString(value.albumImageUrl) &&
    Array.isArray(value.artists) &&
    value.artists.length > 0 &&
    value.artists.every(isArtistRef)
  )
}

const isTrackList = (value: unknown): value is LibraryTrack[] => Array.isArray(value) && value.every(isTrack)

// Checked in full on load: a stored record is outside the type system, and a bad one should mean a rescan, not a crash.
export function readLibraryRecord(record: unknown): Library | null {
  if (!isRecord(record) || record.version !== RECORD_VERSION || !isRecord(record.library)) return null
  const { source, fetchedAt, tracks } = record.library
  return source === 'spotify' && isString(fetchedAt) && isTrackList(tracks) ? { source, fetchedAt, tracks } : null
}

export function readPartialScanRecord(record: unknown): PartialScan | null {
  if (!isRecord(record) || record.version !== RECORD_VERSION || !isRecord(record.scan)) return null
  const { tracks, nextOffset, total, startedAt } = record.scan
  const valid =
    isTrackList(tracks) &&
    Number.isInteger(nextOffset) &&
    (nextOffset as number) >= 0 &&
    Number.isInteger(total) &&
    isString(startedAt)
  return valid ? { tracks, nextOffset: nextOffset as number, total: total as number, startedAt } : null
}

function isArtistDetails(value: unknown): value is ArtistDetails {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNullableString(value.imageUrl) &&
    Array.isArray(value.genres) &&
    value.genres.every(isString)
  )
}

export function readArtistDetailsRecord(record: unknown): SavedArtistDetails | null {
  if (!isRecord(record) || record.version !== RECORD_VERSION || !isRecord(record.record)) return null
  const { details, fetchedAt } = record.record
  if (typeof fetchedAt !== 'number' || !(details === null || isArtistDetails(details))) return null
  return { details, fetchedAt }
}

/** Used when IndexedDB is unavailable, and in tests. Copies on the way in and out, like IndexedDB does. */
export function createMemoryLibraryStore(): LibraryStore {
  let library: Library | null = null
  let scan: PartialScan | null = null
  let artistDetails: Record<string, SavedArtistDetails> = {}

  return {
    persistent: false,
    async loadLibrary() {
      return structuredClone(library)
    },
    async saveLibrary(next) {
      library = structuredClone(next)
      scan = null
    },
    async loadPartialScan() {
      return structuredClone(scan)
    },
    async savePartialScan(next) {
      scan = structuredClone(next)
    },
    async discardPartialScan() {
      scan = null
    },
    async loadArtistDetails() {
      return structuredClone(artistDetails)
    },
    async saveArtistDetails(artistId, record) {
      artistDetails = { ...artistDetails, [artistId]: structuredClone(record) }
    },
    async clear() {
      library = null
      scan = null
      artistDetails = {}
    },
  }
}
