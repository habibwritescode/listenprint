import { describe, expect, it } from 'vitest'
import { parseSearch, stringifySearch } from './search-params.ts'

describe('parseSearch', () => {
  it('keeps a digit string longer than a safe integer as text', () => {
    expect(parseSearch('?state=12345678901234567890')).toEqual({ state: '12345678901234567890' })
  })

  it.each([
    ['a number that round-trips', '?page=12', { page: 12 }],
    ['a boolean', '?open=true', { open: true }],
    ['plain text', '?mode=primary', { mode: 'primary' }],
    ['exponent notation, which would not round-trip', '?code=1e5', { code: '1e5' }],
    ['a leading zero, which is not JSON', '?code=0123', { code: '0123' }],
  ])('parses %s', (_case, search, expected) => {
    expect(parseSearch(search)).toEqual(expected)
  })
})

describe('stringifySearch', () => {
  it.each([
    { state: '12345678901234567890' },
    { mode: 'primary' },
    { code: '1e5' },
    { page: 12, open: true },
    { quoted: '12' },
  ])('round-trips %o through parseSearch', (search) => {
    expect(parseSearch(stringifySearch(search))).toEqual(search)
  })

  it('writes plain text without quotes', () => {
    expect(stringifySearch({ mode: 'primary', state: '12345678901234567890' })).toBe(
      '?mode=primary&state=12345678901234567890',
    )
  })
})
