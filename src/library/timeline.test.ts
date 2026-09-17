import { describe, expect, it } from 'vitest'
import { makeTrack } from '../test/factories.ts'
import { isTimelineGrain } from './timeline-grain.ts'
import { hasEnoughHistory, libraryTimeline, timelineStats } from './timeline.ts'
import type { TimelineBucket } from './timeline.ts'

function likedOn(dates: readonly string[]) {
  return dates.map((addedAt) => makeTrack({ addedAt }))
}

/** A like in every month from January 2025 to the given month of 2025, with `counts[i]` likes in month i. */
function monthlyCounts(counts: readonly number[]) {
  return counts.flatMap((count, month) =>
    likedOn(Array.from({ length: count }, () => `2025-${String(month + 1).padStart(2, '0')}-15T12:00:00.000Z`)),
  )
}

function counts(buckets: readonly TimelineBucket[]): number[] {
  return buckets.map((bucket) => bucket.count)
}

describe('libraryTimeline by month', () => {
  it('counts likes per month, from the first like to the last', () => {
    const buckets = libraryTimeline(likedOn(['2025-01-05T00:00:00.000Z', '2025-03-09T00:00:00.000Z']), 'month')

    expect(buckets.map((bucket) => [bucket.key, bucket.label, bucket.count])).toEqual([
      ['2025-01', 'Jan 2025', 1],
      ['2025-02', 'Feb 2025', 0],
      ['2025-03', 'Mar 2025', 1],
    ])
  })

  // The artist page shows liked dates in UTC, so the chart has to group by the same day boundaries.
  it('groups by UTC months, whatever the machine is set to', () => {
    const buckets = libraryTimeline(likedOn(['2026-01-01T00:30:00.000Z', '2025-12-31T23:30:00.000Z']), 'month')

    expect(counts(buckets)).toEqual([1, 1])
    expect(buckets[0].key).toBe('2025-12')
  })

  it('shares a month against its own year, and marks January for the axis', () => {
    const buckets = libraryTimeline(monthlyCounts([3, 1]), 'month')

    expect(buckets[0].share).toBeCloseTo(0.75)
    expect(buckets[1].share).toBeCloseTo(0.25)
    expect([buckets[0].tick, buckets[1].tick]).toEqual(['2025', ''])
  })

  // A year nobody liked anything in still has months, and a share of nothing is 0, not a division by zero.
  it('keeps the months of a year with no likes in it', () => {
    const buckets = libraryTimeline(likedOn(['2024-12-05T00:00:00.000Z', '2026-01-09T00:00:00.000Z']), 'month')

    expect(buckets).toHaveLength(14)
    expect(buckets.slice(1, 13).every((bucket) => bucket.count === 0 && bucket.share === 0)).toBe(true)
    expect(buckets.at(-1)?.key).toBe('2026-01')
  })

  it('has nothing to show for a library with no tracks', () => {
    expect(libraryTimeline([], 'month')).toEqual([])
  })

  // A record the store let through with an unusable date must not create an Invalid Date bucket.
  it('ignores tracks with an unreadable liked date', () => {
    const tracks = [...likedOn(['2025-01-05T00:00:00.000Z']), makeTrack({ addedAt: 'whenever' })]
    const buckets = libraryTimeline(tracks, 'month')

    expect(counts(buckets)).toEqual([1])
  })
})

describe('libraryTimeline by year', () => {
  it('counts likes per year, filling years with none, and shares against the whole library', () => {
    const buckets = libraryTimeline(
      likedOn(['2024-02-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z']),
      'year',
    )

    expect(buckets.map((bucket) => [bucket.label, bucket.count, bucket.tick])).toEqual([
      ['2024', 1, '2024'],
      ['2025', 0, '2025'],
      ['2026', 2, '2026'],
    ])
    expect(buckets[2].share).toBeCloseTo(2 / 3)
  })
})

describe('timelineStats', () => {
  it('reports the busiest month and how many months it covers', () => {
    const stats = timelineStats(libraryTimeline(monthlyCounts([1, 5, 2]), 'month'))

    expect(stats?.busiest).toEqual({ label: 'Feb 2025', count: 5 })
    expect(stats?.typical.months).toBe(3)
  })

  it('takes the median month with an odd number of months', () => {
    expect(timelineStats(libraryTimeline(monthlyCounts([1, 9, 4]), 'month'))?.typical.count).toBe(4)
  })

  it('averages the middle two months with an even number of months', () => {
    expect(timelineStats(libraryTimeline(monthlyCounts([1, 4, 9, 2]), 'month'))?.typical.count).toBe(3)
  })

  it('compares the last twelve months with the twelve before them', () => {
    const before = Array.from({ length: 12 }, () => '2024-06-15T00:00:00.000Z')
    const after = Array.from({ length: 18 }, () => '2025-06-15T00:00:00.000Z')
    const stats = timelineStats(libraryTimeline(likedOn([...before, ...after]), 'month'))

    expect(stats?.lastYear.count).toBe(18)
    expect(stats?.lastYear.changePercent).toBe(50)
  })

  // Claiming a change against a year that holds nothing would read as a collapse or a boom that never happened.
  it('leaves out the change when there is no full year before', () => {
    const stats = timelineStats(libraryTimeline(monthlyCounts([2, 3]), 'month'))

    expect(stats?.lastYear.count).toBe(5)
    expect(stats?.lastYear.changePercent).toBeNull()
  })

  it('has nothing to report without months', () => {
    expect(timelineStats([])).toBeNull()
  })
})

describe('hasEnoughHistory', () => {
  it('needs about a year before the shape of a habit means anything', () => {
    expect(hasEnoughHistory(libraryTimeline(monthlyCounts(Array.from({ length: 11 }, () => 1)), 'month'))).toBe(false)
    expect(hasEnoughHistory(libraryTimeline(monthlyCounts(Array.from({ length: 12 }, () => 1)), 'month'))).toBe(true)
  })

  it('is false for an empty library', () => {
    expect(hasEnoughHistory([])).toBe(false)
  })
})

describe('isTimelineGrain', () => {
  it('accepts the grains the URL may carry, and nothing else', () => {
    expect(isTimelineGrain('month')).toBe(true)
    expect(isTimelineGrain('year')).toBe(true)
    expect(isTimelineGrain('week')).toBe(false)
    expect(isTimelineGrain(undefined)).toBe(false)
  })
})
