import { useSuspenseQuery } from '@tanstack/react-query'
import { demoLibraryQueryOptions } from '../demo/demo-library-query.ts'
import { rankArtists } from '../library/rankings.ts'

const countFormat = new Intl.NumberFormat()
// UTC so a like near midnight on the 1st never shifts into the neighbouring month.
const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' })

export function DemoPage() {
  const { data: library } = useSuspenseQuery(demoLibraryQueryOptions)
  const artistCount = rankArtists(library.tracks, 'all').length
  const newest = library.tracks.at(0)
  const oldest = library.tracks.at(-1)

  return (
    <section aria-labelledby="demo-title">
      <h1 id="demo-title" className="text-3xl font-bold tracking-tight">
        Demo library
      </h1>
      <p className="mt-2 text-muted">
        A generated library of fictional artists, so you can explore Listenprint without a Spotify account.
      </p>

      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-surface p-4">
          <dt className="text-sm text-muted">Liked tracks</dt>
          <dd className="mt-1 text-2xl font-semibold">{countFormat.format(library.tracks.length)}</dd>
        </div>
        <div className="rounded-md border border-border bg-surface p-4">
          <dt className="text-sm text-muted">Artists</dt>
          <dd className="mt-1 text-2xl font-semibold">{countFormat.format(artistCount)}</dd>
        </div>
        {newest && oldest && (
          <div className="rounded-md border border-border bg-surface p-4">
            <dt className="text-sm text-muted">Liked between</dt>
            <dd className="mt-1 text-2xl font-semibold">
              {monthFormat.formatRange(new Date(oldest.addedAt), new Date(newest.addedAt))}
            </dd>
          </div>
        )}
      </dl>
    </section>
  )
}

export function DemoPagePending() {
  return (
    <p role="status" className="text-muted">
      Building demo library…
    </p>
  )
}
