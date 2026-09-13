import { describe, expect, it } from 'vitest'
import { createRandom, cumulative, zipfWeights } from './random.ts'

function draws<T>(count: number, draw: () => T): T[] {
  return Array.from({ length: count }, draw)
}

describe('createRandom', () => {
  it('produces the reference mulberry32 sequence for seed 1', () => {
    const random = createRandom(1)

    expect(draws(3, random.next)).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522])
  })

  it('repeats the same sequence for the same seed', () => {
    expect(draws(5, createRandom(42).next)).toEqual(draws(5, createRandom(42).next))
  })

  it('produces a different sequence for a different seed', () => {
    expect(createRandom(1).next()).not.toBe(createRandom(2).next())
  })

  it('keeps next() within [0, 1)', () => {
    const values = draws(10_000, createRandom(7).next)

    expect(Math.min(...values)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...values)).toBeLessThan(1)
  })
})

describe('int', () => {
  it('stays within inclusive bounds and reaches both ends', () => {
    const random = createRandom(3)

    const values = new Set(draws(10_000, () => random.int(2, 5)))

    expect([...values].sort()).toEqual([2, 3, 4, 5])
  })
})

describe('pick', () => {
  it('always returns an element of a non-empty array', () => {
    const random = createRandom(4)
    const items = ['a', 'b', 'c'] as const

    const picked = new Set(draws(1_000, () => random.pick(items)))

    expect([...picked].sort()).toEqual(['a', 'b', 'c'])
  })

  it('throws for an empty array', () => {
    expect(() => createRandom(4).pick([])).toThrow()
  })
})

describe('chance', () => {
  it('is never true at 0 and always true at 1', () => {
    const random = createRandom(5)

    expect(draws(1_000, () => Number(random.chance(0))).every((v) => v === 0)).toBe(true)
    expect(draws(1_000, () => Number(random.chance(1))).every((v) => v === 1)).toBe(true)
  })
})

describe('weightedIndex', () => {
  it('returns each index in proportion to its weight', () => {
    const random = createRandom(6)
    const table = cumulative([1, 2, 3, 4])
    const counts = [0, 0, 0, 0]

    for (let i = 0; i < 50_000; i += 1) counts[random.weightedIndex(table)] += 1

    const shares = counts.map((count) => count / 50_000)
    ;[0.1, 0.2, 0.3, 0.4].forEach((expected, index) => {
      expect(Math.abs(shares[index] - expected)).toBeLessThanOrEqual(0.02)
    })
  })

  it('never returns an index with zero weight', () => {
    const random = createRandom(8)
    const table = cumulative([0, 5, 0, 5])

    const indices = new Set(draws(5_000, () => random.weightedIndex(table)))

    expect([...indices].sort()).toEqual([1, 3])
  })

  it('throws when there is no weight to draw from', () => {
    expect(() => createRandom(9).weightedIndex([])).toThrow()
    expect(() => createRandom(9).weightedIndex(cumulative([0, 0]))).toThrow()
  })
})

describe('cumulative', () => {
  it('returns running totals', () => {
    expect(cumulative([1, 2, 3, 4])).toEqual([1, 3, 6, 10])
  })
})

describe('zipfWeights', () => {
  it('starts at 1 and strictly decreases', () => {
    const weights = zipfWeights(50, 0.7)

    expect(weights).toHaveLength(50)
    expect(weights[0]).toBe(1)
    weights.slice(1).forEach((weight, index) => {
      expect(weight).toBeLessThan(weights[index])
    })
  })
})
