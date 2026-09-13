interface ListSkeletonProps {
  label: string
}

const PLACEHOLDER_ROWS = 8

export function ListSkeleton({ label }: ListSkeletonProps) {
  return (
    <div role="status" aria-busy="true" className="space-y-2">
      <span className="sr-only">{label}</span>
      {Array.from({ length: PLACEHOLDER_ROWS }, (_, index) => (
        <div key={index} data-slot="skeleton-row" aria-hidden className="h-18 animate-pulse rounded-md bg-surface" />
      ))}
    </div>
  )
}
