/** The parts of a router location change the decision needs. */
export interface LocationChange {
  fromLocation?: { pathname: string }
  toLocation: { pathname: string }
}

export type ArtistTransitionType = 'artist-open' | 'artist-close'

type Page = { kind: 'ranking' | 'artist'; base: string }

function pageAt(pathname: string): Page | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/' || path === '/demo') return { kind: 'ranking', base: path }
  const artist = /^(\/demo)?\/artist\/[^/]+$/.exec(path)
  return artist ? { kind: 'artist', base: artist[1] ?? '/' } : null
}

/**
 * The view transition types for a navigation, or `false` for none. Only a ranking and one of its own artist pages
 * animate; everything else, mode and sort changes included, swaps instantly.
 */
export function artistTransitionTypes({ fromLocation, toLocation }: LocationChange): ArtistTransitionType[] | false {
  const from = fromLocation && pageAt(fromLocation.pathname)
  const to = pageAt(toLocation.pathname)
  if (!from || !to || from.base !== to.base || from.kind === to.kind) return false
  return [to.kind === 'artist' ? 'artist-open' : 'artist-close']
}

/**
 * The tile's `view-transition-name` for an artist. Local-file artist ids hold whatever the file says, so every
 * character outside `[A-Za-z0-9-]`, underscore included, becomes `_<hex>_`: always a valid identifier, and no two ids
 * collide.
 */
export function artistTileName(artistId: string): string {
  return `artist-${artistId.replace(/[^A-Za-z0-9-]/gu, (character) => `_${character.codePointAt(0)!.toString(16)}_`)}`
}
