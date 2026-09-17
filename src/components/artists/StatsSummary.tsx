import { concentration, roundedPercents } from '../../library/presentation.ts'
import type { Concentration } from '../../library/presentation.ts'
import type { ArtistRanking } from '../../library/types.ts'

interface StatsSummaryProps {
  rankings: readonly ArtistRanking[]
  trackCount: number
  /** What the saved-tracks and artists figures mean for this library, such as that it's the sample. */
  notes: { tracks: string; artists: string }
  /** While a first scan runs: every figure is a dash, since nothing has been counted yet. */
  pending?: boolean
}

const countFormat = new Intl.NumberFormat()

const labelClass = 'text-2xs tracking-[0.12em] text-subtle uppercase'
const figureClass = 'mt-2.75 text-4xl leading-none font-bold tracking-[-0.03em] tabular-nums'
const noteClass = 'mt-2 text-md leading-[1.45] text-muted'

function concentrationNote(tiers: Concentration | null, trackCount: number): string {
  const tracks = `${countFormat.format(tiers?.top10Tracks ?? 0)} of ${countFormat.format(trackCount)} tracks`
  // Ties can put more than ten artists at ranks 1–10; "Top 10 artists" would then be wrong.
  if (tiers && tiers.top10Artists > 10) {
    return `Top 10 ranks · ${countFormat.format(tiers.top10Artists)} artists · ${tracks}`
  }
  return `Top 10 artists · ${tracks}`
}

export function StatsSummary({ rankings, trackCount, notes, pending = false }: StatsSummaryProps) {
  const tiers = pending ? null : concentration(rankings, trackCount)
  const percents = tiers ? roundedPercents([tiers.top10Tracks, tiers.next90Tracks, tiers.restTracks]) : null

  return (
    <div>
      <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border min-[741px]:grid-cols-3">
        <div className="bg-surface px-4.5 pt-4 pb-4.5">
          <dt className={labelClass}>Concentration</dt>
          {/* An empty library has no concentration to report, and a fake 0% would be a claim. */}
          <dd className={`${figureClass} text-bright-accent`}>
            {percents ? (
              <>
                {percents[0]}
                <span className="ml-1 text-lg font-normal opacity-70">%</span>
              </>
            ) : (
              '—'
            )}
          </dd>
          <dd className={noteClass}>{pending ? 'Top 10 artists' : concentrationNote(tiers, trackCount)}</dd>
        </div>
        <div className="bg-surface px-4.5 pt-4 pb-4.5">
          <dt className={labelClass}>Saved tracks</dt>
          <dd className={figureClass}>{pending ? '—' : countFormat.format(trackCount)}</dd>
          <dd className={noteClass}>{notes.tracks}</dd>
        </div>
        <div className="bg-surface px-4.5 pt-4 pb-4.5">
          <dt className={labelClass}>Artists</dt>
          <dd className={figureClass}>{pending ? '—' : countFormat.format(rankings.length)}</dd>
          <dd className={noteClass}>{notes.artists}</dd>
        </div>
      </dl>

      {tiers && percents && (
        <div className="mt-3">
          {/* Widths use exact shares; the legend carries the rounded figures as text. */}
          <div aria-hidden className="flex h-2 overflow-hidden rounded-full bg-raised-surface">
            <span className="bg-accent" style={{ width: `${(tiers.top10Tracks / trackCount) * 100}%` }} />
            <span
              className="border-l border-background bg-chart-fill"
              style={{ width: `${(tiers.next90Tracks / trackCount) * 100}%` }}
            />
          </div>
          <ul className="mt-2.25 flex flex-wrap gap-x-4.5 gap-y-1 text-2xs tracking-[0.06em] uppercase tabular-nums">
            <li className="text-bright-accent">{`Top 10 · ${percents[0]}%`}</li>
            {tiers.next90Artists > 0 && <li className="text-muted">{`Next 90 · ${percents[1]}%`}</li>}
            {tiers.restArtists > 0 && (
              <li className="text-subtle">{`The other ${countFormat.format(tiers.restArtists)} · ${percents[2]}%`}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
