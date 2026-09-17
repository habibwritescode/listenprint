// The grain is its own module, so validating a URL doesn't pull this whole file into the main bundle.
import type { TimelineGrain } from './timeline-grain.ts'
import type { LibraryTrack } from './types.ts'

export type { TimelineGrain }



export interface TimelineBucket {
  /** `2026-03` by month, `2026` by year. */
  key: string
  /** `Mar 2026` by month, `2026` by year. */
  label: string
  /** The axis label: the year on January and on every year bucket, empty on other months. */
  tick: string
  count: number
  /**
   * Share of the bucket's own denominator: a month of its year, a year of the whole library. One denominator across
   * both grains would make the yearly figure a lie, since a year is all of itself.
   */
  share: number
}

export interface TimelineStats {
  busiest: { label: string; count: number }
  /** The median month, and how many months it was taken across. */
  typical: { count: number; months: number }
  /** `changePercent` is null when there's no full year before to compare with. */
  lastYear: { count: number; changePercent: number | null }
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_PER_YEAR = 12

/** Months counted from year 0, so a range of months is plain arithmetic. */
function monthIndex(year: number, month: number): number {
  return year * MONTHS_PER_YEAR + month
}

function likedMonths(tracks: readonly LibraryTrack[]): number[] {
  const months: number[] = []
  for (const track of tracks) {
    const liked = new Date(track.addedAt)
    const time = liked.getTime()
    if (Number.isNaN(time)) continue
    months.push(monthIndex(liked.getUTCFullYear(), liked.getUTCMonth()))
  }
  return months
}

function monthBucket(index: number, count: number, yearTotal: number): TimelineBucket {
  const year = Math.floor(index / MONTHS_PER_YEAR)
  const month = index % MONTHS_PER_YEAR
  return {
    key: `${year}-${String(month + 1).padStart(2, '0')}`,
    label: `${MONTH_NAMES[month]} ${year}`,
    // Labelling ninety months is unreadable; year boundaries are the units people think in.
    tick: month === 0 ? String(year) : '',
    count,
    share: yearTotal === 0 ? 0 : count / yearTotal,
  }
}

/**
 * Liked songs per month or per year, from the first like to the last, with empty periods kept so gaps in a library
 * read as gaps rather than closing up. Months are UTC, as the liked dates are shown everywhere else.
 */
export function libraryTimeline(tracks: readonly LibraryTrack[], grain: TimelineGrain): TimelineBucket[] {
  const months = likedMonths(tracks)
  if (months.length === 0) return []

  const countsByMonth = new Map<number, number>()
  for (const month of months) countsByMonth.set(month, (countsByMonth.get(month) ?? 0) + 1)

  const first = Math.min(...months)
  const last = Math.max(...months)

  if (grain === 'year') {
    const firstYear = Math.floor(first / MONTHS_PER_YEAR)
    const lastYear = Math.floor(last / MONTHS_PER_YEAR)
    const byYear: TimelineBucket[] = []
    for (let year = firstYear; year <= lastYear; year += 1) {
      let count = 0
      for (let month = 0; month < MONTHS_PER_YEAR; month += 1) count += countsByMonth.get(monthIndex(year, month)) ?? 0
      byYear.push({ key: String(year), label: String(year), tick: String(year), count, share: count / months.length })
    }
    return byYear
  }

  const yearTotals = new Map<number, number>()
  for (const month of months) {
    const year = Math.floor(month / MONTHS_PER_YEAR)
    yearTotals.set(year, (yearTotals.get(year) ?? 0) + 1)
  }

  const byMonth: TimelineBucket[] = []
  for (let index = first; index <= last; index += 1) {
    const year = Math.floor(index / MONTHS_PER_YEAR)
    byMonth.push(monthBucket(index, countsByMonth.get(index) ?? 0, yearTotals.get(year) ?? 0))
  }
  return byMonth
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

function total(months: readonly TimelineBucket[]): number {
  return months.reduce((sum, month) => sum + month.count, 0)
}

/** The summary above the chart, so the shape is readable without interpreting bars. */
export function timelineStats(months: readonly TimelineBucket[]): TimelineStats | null {
  if (months.length === 0) return null

  const busiest = months.reduce((leader, month) => (month.count > leader.count ? month : leader))
  const lastTwelve = total(months.slice(-MONTHS_PER_YEAR))
  const previousTwelve = total(months.slice(-MONTHS_PER_YEAR * 2, -MONTHS_PER_YEAR))

  return {
    busiest: { label: busiest.label, count: busiest.count },
    typical: { count: median(months.map((month) => month.count)), months: months.length },
    lastYear: {
      count: lastTwelve,
      changePercent: previousTwelve === 0 ? null : Math.round((lastTwelve / previousTwelve - 1) * 100),
    },
  }
}

/**
 * Four bars stretched across a chart imply a trend that isn't there; a year is where the shape starts to mean
 * something.
 */
export function hasEnoughHistory(months: readonly TimelineBucket[]): boolean {
  return months.length >= MONTHS_PER_YEAR
}
