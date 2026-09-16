interface ArtistStatsProps {
  savedTracks: number
  /** A fraction of the whole library. */
  share: number
  asPrimary: number
  /** `YYYY-MM` in UTC. */
  firstLiked: string | null
}

const countFormat = new Intl.NumberFormat()
const shareFormat = new Intl.NumberFormat(undefined, {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function ArtistStats({ savedTracks, share, asPrimary, firstLiked }: ArtistStatsProps) {
  const cells = [
    { label: 'Saved tracks', value: countFormat.format(savedTracks), accent: false },
    { label: 'Share of library', value: shareFormat.format(share), accent: true },
    { label: 'As primary', value: countFormat.format(asPrimary), accent: false },
    { label: 'First liked', value: firstLiked ?? '—', accent: false },
  ]

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
      {cells.map((cell) => (
        <div key={cell.label} className="bg-background px-4.25 pt-3.75 pb-4.25">
          <dt className="text-2xs tracking-[0.11em] text-subtle uppercase">{cell.label}</dt>
          <dd className={`mt-2.25 text-2xl tabular-nums ${cell.accent ? 'text-bright-accent' : ''}`}>{cell.value}</dd>
        </div>
      ))}
    </dl>
  )
}
