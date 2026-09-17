import { describe, expect, it } from 'vitest'
import { interruptionMessage, scanProgressText, timeLeftText } from './scan-format.ts'

describe('scanProgressText', () => {
  it('counts tracks once the total is known', () => {
    expect(scanProgressText(2_400, 10_000)).toBe('Read 2,400 of 10,000 liked songs…')
  })

  it('says it is starting before the first page arrives', () => {
    expect(scanProgressText(0, null)).toBe('Reading your liked songs…')
  })
})

describe('timeLeftText', () => {
  it.each([
    [null, null],
    [0, null],
    [3_000, 'a few seconds left'],
    [31_000, 'about 35 seconds left'],
    [59_000, 'about 1 minute left'],
    [150_000, 'about 3 minutes left'],
  ])('describes %j ms as %j', (ms, expected) => {
    expect(timeLeftText(ms)).toBe(expected)
  })
})

describe('interruptionMessage', () => {
  const at = { read: 50, total: 120, retryAfterMs: null }

  it.each([
    ['network', 'Your connection dropped, so the scan stopped at 50 of 120 liked songs.'],
    ['unavailable', 'Spotify stopped responding, so the scan paused at 50 of 120 liked songs.'],
    [
      'forbidden',
      'Spotify refused access to your library at 50 of 120 liked songs. ' +
        'If your invite was removed, the demo still works.',
    ],
    ['failed', 'Something went wrong reading your library, at 50 of 120 liked songs.'],
    ['cancelled', 'You stopped the scan at 50 of 120 liked songs.'],
    ['closed', 'An earlier scan stopped at 50 of 120 liked songs when its tab closed.'],
    ['rateLimited', 'Spotify asked Listenprint to slow down at 50 of 120 liked songs.'],
    ['quota', 'Listenprint has used up its Spotify requests for now, at 50 of 120 liked songs. Try again later.'],
  ] as const)('explains %s', (reason, expected) => {
    expect(interruptionMessage({ ...at, reason })).toBe(expected)
  })

  it('names the wait when Spotify gave one', () => {
    expect(interruptionMessage({ ...at, reason: 'rateLimited', retryAfterMs: 300_000 })).toBe(
      'Spotify asked Listenprint to wait 5 minutes at 50 of 120 liked songs.',
    )
    expect(interruptionMessage({ ...at, reason: 'quota', retryAfterMs: 90_000 })).toBe(
      'Listenprint has used up its Spotify requests for now, at 50 of 120 liked songs. Try again in 2 minutes.',
    )
  })

  it('says "before reading any" when no page arrived', () => {
    expect(interruptionMessage({ read: 0, total: null, retryAfterMs: null, reason: 'network' })).toBe(
      'Your connection dropped, so the scan stopped before reading any liked songs.',
    )
  })
})
