import type { ReactNode } from 'react'
import { hasEnoughHistory, libraryTimeline, timelineStats } from '../../library/timeline.ts'
import type { TimelineBucket } from '../../library/timeline.ts'
import type { TimelineGrain } from '../../library/timeline-grain.ts'
import type { LibraryTrack } from '../../library/types.ts'
import { BarChart } from './BarChart.tsx'
import type { ChartBar } from './BarChart.tsx'

interface TimelineViewProps {
  tracks: readonly LibraryTrack[]
  grain: TimelineGrain
  /** One line under the heading, naming whose library this is. */
  subtitle: string
  /** Shown instead of the chart under a year of history, after the few bars it does have. */
  sparseBody: string
  /** Links out of the sparse state. */
  sparseActions: ReactNode
}

const countFormat = new Intl.NumberFormat()

function share(bucket: TimelineBucket, grain: TimelineGrain): string {
  const percent = Math.round(bucket.share * 100)
  return grain === 'year' ? `${percent}% of the library` : `${percent}% of ${bucket.key.slice(0, 4)}`
}

function toBar(bucket: TimelineBucket, grain: TimelineGrain): ChartBar {
  const saved = bucket.count === 1 ? '1 song saved' : `${countFormat.format(bucket.count)} songs saved`
  return {
    key: bucket.key,
    label: bucket.label,
    tick: bucket.tick,
    value: bucket.count,
    share: bucket.share,
    name: `${bucket.label}, ${saved}, ${share(bucket, grain)}`,
    readout: [{ label: 'Share', value: share(bucket, grain) }],
  }
}

interface StatProps {
  label: string
  value: string
  note: string
  /** The one figure the design colours: the last twelve months. */
  bright?: boolean
}

function Stat({ label, value, note, bright = false }: StatProps) {
  return (
    <div className="rounded-md border border-border bg-surface px-4 py-3.5">
      <p className="text-2xs tracking-[0.12em] text-subtle uppercase tabular-nums">{label}</p>
      <p className={`mt-1.5 text-2xl tabular-nums ${bright ? 'text-bright-accent' : ''}`}>{value}</p>
      <p className="mt-1 text-sm text-muted">{note}</p>
    </div>
  )
}

/** Liked songs over time, for any library: the sample and the signed-in user's render the same view. */
export function TimelineView({ tracks, grain, subtitle, sparseBody, sparseActions }: TimelineViewProps) {
  const buckets = libraryTimeline(tracks, grain)
  const months = grain === 'month' ? buckets : libraryTimeline(tracks, 'month')
  const stats = timelineStats(months)
  const enough = hasEnoughHistory(months)

  return (
    <section aria-labelledby="timeline-title" className="space-y-5">
      <div>
        <h1 id="timeline-title" className="text-2xl font-bold tracking-[-0.025em]">
          Library timeline
        </h1>
        <p className="mt-2 max-w-[64ch] text-base text-muted">{subtitle}</p>
      </div>

      {enough && stats && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label="Busiest month"
            value={stats.busiest.label}
            note={`${countFormat.format(stats.busiest.count)} songs saved`}
          />
          <Stat
            label="Typical month"
            value={countFormat.format(stats.typical.count)}
            note={`Across ${stats.typical.months} months`}
          />
          <Stat
            label="Last 12 months"
            value={countFormat.format(stats.lastYear.count)}
            note={
              stats.lastYear.changePercent === null
                ? 'No earlier year to compare with'
                : `${stats.lastYear.changePercent >= 0 ? '+' : ''}${stats.lastYear.changePercent}% on the year before`
            }
            bright
          />
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
        <BarChart
          label={grain === 'year' ? 'Liked songs by year' : 'Liked songs by month'}
          layout="columns"
          bars={buckets.map((bucket) => toBar(bucket, grain))}
          valueSuffix="songs saved"
        />
      </div>

      {!enough && (
        <div className="space-y-3.5 rounded-lg border border-border bg-surface px-4 py-4 sm:px-5">
          <h2 className="text-lg font-semibold">Not enough history to read a trend yet</h2>
          <p className="max-w-[64ch] text-base text-muted">{sparseBody}</p>
          <div className="flex flex-wrap gap-2.5">{sparseActions}</div>
        </div>
      )}
    </section>
  )
}
