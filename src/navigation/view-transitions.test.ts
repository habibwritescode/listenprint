import { describe, expect, it } from 'vitest'
import { artistTransitionTypes } from './view-transitions.ts'

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
