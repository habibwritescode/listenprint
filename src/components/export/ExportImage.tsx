import { artistInitial, avatarTone } from '../../library/presentation.ts'
import type { ExportRow } from '../../library/export.ts'

export interface ExportImageProps {
  rows: readonly ExportRow[]
  /** The share of the library these artists hold, as a percentage string. */
  share: string
  trackCount: string
  /** `16 SEP 2026` or `16 SEP 2026 · SAMPLE LIBRARY`. */
  stamp: string
  sample: boolean
}

const TONE_CLASSES: Record<number, string> = {
  1: 'bg-avatar-tint-1 text-avatar-ink-1',
  2: 'bg-avatar-tint-2 text-avatar-ink-2',
  3: 'bg-avatar-tint-3 text-avatar-ink-3',
  4: 'bg-avatar-tint-4 text-avatar-ink-4',
}

const countFormat = new Intl.NumberFormat()

// Sizes are in pixels rather than the app's type ramp: this canvas is always 1200×1200, whatever the screen.
function Row({ row }: { row: ExportRow }) {
  return (
    <div className="flex flex-1 items-center gap-5 border-b border-border">
      <span className="w-10 text-right text-[24px] text-subtle tabular-nums">{row.rank}</span>
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-md text-[20px] font-semibold ${TONE_CLASSES[avatarTone(row.name)]}`}
      >
        {artistInitial(row.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[26px] tracking-[-0.01em]">{row.name}</span>
        <span className="mt-2 block h-1.5 rounded-full bg-chart-fill" style={{ width: `${row.barPercent}%` }} />
      </span>
      <span className="text-[26px] tabular-nums">{countFormat.format(row.count)}</span>
    </div>
  )
}

/**
 * The shareable square. It draws its own layout rather than capturing the list, which only ever holds the rows on
 * screen, and it uses letter tiles: a Spotify photo would need the canvas to reach another origin.
 */
export function ExportImage({ rows, share, trackCount, stamp, sample }: ExportImageProps) {
  const columns = rows.length > 10 ? [rows.slice(0, 10), rows.slice(10)] : [rows]

  return (
    <div className="flex size-[1200px] flex-col bg-background px-16 py-14 font-sans text-text">
      <div className="flex items-start justify-between gap-8">
        <div>
          <p className="flex items-center gap-4 text-[38px] font-semibold tracking-[-0.02em]">
            <span className="size-6 rounded-[7px] bg-accent" />
            listenprint
          </p>
          <p className="mt-9 text-[24px] tracking-[0.1em] text-subtle uppercase tabular-nums">
            {`My top ${rows.length} artists`}
          </p>
          <p className="mt-4 flex items-baseline gap-4">
            <span className="text-[76px] leading-none font-bold tracking-[-0.035em] text-bright-accent tabular-nums">
              {share}
            </span>
            <span className="text-[26px] text-muted">{`of ${trackCount} tracks`}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[22px] tracking-[0.08em] text-subtle tabular-nums">{stamp}</p>
          {sample && (
            <p className="mt-4 inline-flex items-center gap-2.5 rounded-full border border-border bg-soft-highlight px-4 py-2 text-[20px] tracking-[0.07em] text-highlight uppercase">
              <span className="size-2.5 rounded-full bg-highlight" />
              Sample data
            </p>
          )}
        </div>
      </div>

      <div className="mt-12 flex flex-1 gap-14">
        {columns.map((column) => (
          <div key={column[0]?.id ?? 'empty'} className="flex flex-1 flex-col">
            {column.map((row) => (
              <Row key={row.id} row={row} />
            ))}
          </div>
        ))}
      </div>

      <p className="mt-10 text-[22px] text-subtle">listenprint.app · read in your browser, never uploaded</p>
    </div>
  )
}
