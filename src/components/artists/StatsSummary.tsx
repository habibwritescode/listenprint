import type { LibraryStats } from '../../library/presentation.ts'

interface StatsSummaryProps {
  stats: LibraryStats
}

const countFormat = new Intl.NumberFormat()

const TILES = [
  { label: 'Liked tracks', key: 'trackCount' },
  { label: 'Artists ranked', key: 'artistCount' },
  { label: 'Songs by #1', key: 'leaderCount' },
] as const

export function StatsSummary({ stats }: StatsSummaryProps) {
  return (
    <dl className="grid gap-4 sm:grid-cols-3">
      {TILES.map((tile) => (
        <div key={tile.key} className="rounded-md border border-border bg-surface p-4">
          <dt className="text-sm text-muted">{tile.label}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{countFormat.format(stats[tile.key])}</dd>
        </div>
      ))}
    </dl>
  )
}
