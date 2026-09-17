import { describe, expect, it } from 'vitest'
import { artistTileName, artistTransitionTypes } from './view-transitions.ts'

function change(from: string | undefined, to: string) {
  return { fromLocation: from === undefined ? undefined : { pathname: from }, toLocation: { pathname: to } }
}

describe('artistTransitionTypes', () => {
  it('opens an artist from the ranking it belongs to', () => {
    expect(artistTransitionTypes(change('/', '/artist/abc'))).toEqual(['artist-open'])
    expect(artistTransitionTypes(change('/demo', '/demo/artist/abc'))).toEqual(['artist-open'])
  })

  it('closes an artist back to its ranking', () => {
    expect(artistTransitionTypes(change('/artist/abc', '/'))).toEqual(['artist-close'])
    expect(artistTransitionTypes(change('/demo/artist/abc', '/demo'))).toEqual(['artist-close'])
  })

  it('treats a trailing slash as the same page', () => {
    expect(artistTransitionTypes(change('/demo/', '/demo/artist/abc/'))).toEqual(['artist-open'])
  })

  it('reads encoded ids, such as local files, as one artist', () => {
    expect(artistTransitionTypes(change('/', '/artist/local%3AMy%20Band'))).toEqual(['artist-open'])
  })

  // A mode or sort toggle only changes the query string, and must never animate.
  it('does not animate when only the search changes', () => {
    expect(artistTransitionTypes(change('/demo', '/demo'))).toBe(false)
    expect(artistTransitionTypes(change('/demo/artist/abc', '/demo/artist/abc'))).toBe(false)
  })

  it('does not animate between the live and demo libraries', () => {
    expect(artistTransitionTypes(change('/', '/demo'))).toBe(false)
    expect(artistTransitionTypes(change('/', '/demo/artist/abc'))).toBe(false)
    expect(artistTransitionTypes(change('/demo/artist/abc', '/'))).toBe(false)
  })

  it('does not animate from one artist to another', () => {
    expect(artistTransitionTypes(change('/demo/artist/abc', '/demo/artist/xyz'))).toBe(false)
  })

  it('does not animate sign-in, unknown pages or the first load', () => {
    expect(artistTransitionTypes(change('/callback', '/'))).toBe(false)
    expect(artistTransitionTypes(change('/', '/nowhere'))).toBe(false)
    expect(artistTransitionTypes(change('/demo/artist/abc/extra', '/demo'))).toBe(false)
    expect(artistTransitionTypes(change(undefined, '/demo/artist/abc'))).toBe(false)
  })
})

describe('artistTileName', () => {
  const identifier = /^-?[A-Za-z_][A-Za-z0-9_-]*$/

  it('prefixes Spotify ids, which are already safe', () => {
    expect(artistTileName('4q3ewBCX7sLwd24euuV69X')).toBe('artist-4q3ewBCX7sLwd24euuV69X')
  })

  // Local-file artists are named by whatever the file says, and a view-transition-name must be a CSS identifier.
  it('escapes every other character into a valid identifier', () => {
    for (const id of ['local:My Band', 'Björk & Co.', '1999', '🎸 riff', 'a_b', '']) {
      expect(artistTileName(id)).toMatch(identifier)
    }
    expect(artistTileName('local:My Band')).toBe('artist-local_3a_My_20_Band')
    expect(artistTileName('🎸')).toBe('artist-_1f3b8_')
  })

  it('never gives two ids the same name', () => {
    expect(artistTileName('a:b')).not.toBe(artistTileName('a_3a_b'))
    expect(artistTileName('a b')).not.toBe(artistTileName('a_20_b'))
  })
})
