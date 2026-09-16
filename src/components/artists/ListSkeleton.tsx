import { ARTIST_ROW_GRID } from './row-format.ts'

interface ListSkeletonProps {
  label: string
}

const PLACEHOLDER_WIDTHS = [
  [72, 38],
  [58, 30],
  [84, 44],
  [49, 26],
  [66, 34],
  [77, 40],
  [54, 28],
] as const

/** Rows at the real 77px height, so data replaces them without shifting the page. Only the avatars shimmer. */
export function ListSkeleton({ label }: ListSkeletonProps) {
  return (
    <div role="status" aria-busy="true" className="overflow-hidden rounded-lg border border-border bg-surface">
      <span className="sr-only">{label}</span>
      {PLACEHOLDER_WIDTHS.map(([name, sample], index) => (
        <div
          key={index}
          data-slot="skeleton-row"
          aria-hidden
          className={`grid h-19.25 items-center gap-3.5 border-b border-border px-4 last:border-b-0 ${ARTIST_ROW_GRID}`}
        >
          <span className="h-2.5 w-3.75 rounded-[3px] bg-raised-surface" />
          <span className="size-11 animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--color-raised-surface)_0%,var(--color-border)_42%,var(--color-raised-surface)_82%)] bg-size-[380px_100%]" />
          <span>
            <span className="block h-2.75 rounded-[3px] bg-raised-surface" style={{ width: `${name}%` }} />
            <span className="mt-2.25 block h-2.25 rounded-[3px] bg-raised-surface" style={{ width: `${sample}%` }} />
          </span>
          <span className="h-2.5 rounded-[3px] bg-raised-surface" />
          <span className="hidden h-1.25 rounded-[3px] bg-raised-surface min-[741px]:block" />
        </div>
      ))}
    </div>
  )
}
