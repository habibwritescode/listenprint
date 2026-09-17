import { describe, expect, it } from 'vitest'
import { MAX_RETRIES, backoffDelay, parseRetryAfter } from './retry.ts'

describe('backoffDelay', () => {
  it('doubles the ceiling from 1 s with each retry, up to 16 s', () => {
    const ceilings = Array.from({ length: 7 }, (_, retry) => backoffDelay(retry, () => 0.999_999))

    expect(ceilings.map(Math.round)).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 16_000, 16_000])
  })

  // Full jitter: clients retrying after the same outage spread across the window instead of arriving together.
  it('picks a delay anywhere between zero and the ceiling', () => {
    expect(backoffDelay(2, () => 0)).toBe(0)
    expect(backoffDelay(2, () => 0.25)).toBe(1_000)
  })

  it('allows four retries', () => {
    expect(MAX_RETRIES).toBe(4)
  })
})

describe('parseRetryAfter', () => {
  it.each([
    ['2', 2_000],
    ['0', 0],
    [' 30 ', 30_000],
  ])('reads %j seconds as %i ms', (header, expected) => {
    expect(parseRetryAfter(header)).toBe(expected)
  })

  it.each([null, '', 'soon', '-1', '1.5', 'Wed, 21 Oct 2026 07:28:00 GMT'])('treats %j as unknown', (header) => {
    expect(parseRetryAfter(header)).toBeNull()
  })
})
