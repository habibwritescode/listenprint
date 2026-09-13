import type { ArtistRef, LibraryTrack } from '../library/types.ts'

let sequence = 0

function nextId(prefix: string): string {
  sequence += 1
  return `${prefix}-${sequence}`
}

/** An artist with a unique id; pass only the fields a test cares about. */
export function makeArtist(overrides: Partial<ArtistRef> = {}): ArtistRef {
  const id = overrides.id ?? nextId('artist')
  return { id, name: `Artist ${id}`, ...overrides }
}

/** A track with a unique id and one generated artist; pass only the fields a test cares about. */
export function makeTrack(overrides: Partial<LibraryTrack> = {}): LibraryTrack {
  const id = overrides.id ?? nextId('track')
  return {
    id,
    name: `Track ${id}`,
    addedAt: '2026-01-01T00:00:00.000Z',
    albumImageUrl: null,
    artists: [makeArtist()],
    ...overrides,
  }
}
