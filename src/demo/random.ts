export interface Random {
  /** Uniform float in [0, 1). */
  next(): number
  /** Uniform integer in [min, max], inclusive on both ends. */
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
  chance(probability: number): boolean
  /** Index drawn in proportion to its weight, given running totals from `cumulative`. */
  weightedIndex(cumulativeWeights: readonly number[]): number
}

/** Deterministic PRNG (mulberry32). Same seed, same sequence, in every JS engine. */
export function createRandom(seed: number): Random {
  let state = seed >>> 0

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => {
      if (items.length === 0) throw new Error('pick: empty array')
      return items[Math.floor(next() * items.length)]
    },
    chance: (probability) => next() < probability,
    weightedIndex: (cumulativeWeights) => {
      const total = cumulativeWeights.at(-1) ?? 0
      if (total <= 0) throw new Error('weightedIndex: no weight to draw from')

      // A zero-weight entry repeats the previous running total, so it is never the first total above the draw.
      const target = next() * total
      let low = 0
      let high = cumulativeWeights.length - 1
      while (low < high) {
        const middle = (low + high) >>> 1
        if (cumulativeWeights[middle] > target) high = middle
        else low = middle + 1
      }
      return low
    },
  }
}

export function cumulative(weights: readonly number[]): number[] {
  let total = 0
  return weights.map((weight) => (total += weight))
}

export function zipfWeights(count: number, exponent: number): number[] {
  return Array.from({ length: count }, (_, index) => 1 / (index + 1) ** exponent)
}
