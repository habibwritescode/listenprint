import { scanProgressText, timeLeftText } from './scan-format.ts'

interface ScanProgressProps {
  read: number
  total: number | null
  estimateMs: number | null
}

// The text isn't a live region: announcing every page would talk over everything else. The progress bar carries the
// numbers for anyone who looks for them.
export function ScanProgress({ read, total, estimateMs }: ScanProgressProps) {
  const timeLeft = timeLeftText(estimateMs)
  const percent = total ? Math.min(100, (read / total) * 100) : 0

  return (
    <div className="rounded-lg border border-border bg-surface px-4.5 py-4">
      <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted tabular-nums">
        <span
          aria-hidden
          data-motion="spinner"
          className="size-2.25 animate-[spin_0.75s_linear_infinite] rounded-full border-2 border-accent border-t-transparent"
        />
        <span>{scanProgressText(read, total)}</span>
        {timeLeft && <span className="text-subtle">{timeLeft}</span>}
      </p>
      <div
        role="progressbar"
        aria-label="Reading liked songs"
        aria-valuemin={0}
        aria-valuemax={total ?? undefined}
        aria-valuenow={total === null ? undefined : read}
        className="mt-2.75 h-0.75 overflow-hidden rounded-full bg-raised-surface"
      >
        <div className="h-full bg-accent transition-[width] duration-fade" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
