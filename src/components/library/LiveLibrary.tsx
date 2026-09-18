import { useState } from 'react'
import { Link, getRouteApi } from '@tanstack/react-router'
import { useLibrary } from '../../hooks/useLibrary.ts'
import { artistImageUrls } from '../../library/artist-images.ts'
import { rankArtists } from '../../library/rankings.ts'
import type { SavedArtistDetails } from '../../spotify/library-store.ts'
import { ghostActionClass, primaryActionClass, softActionClass } from '../action-styles.ts'
import { ListSkeleton } from '../artists/ListSkeleton.tsx'
import { RankingView } from '../artists/RankingView.tsx'
import { StatsSummary } from '../artists/StatsSummary.tsx'
import { scannedNote, tiesNote } from './ranking-notes.ts'
import { ScanProgress } from './ScanProgress.tsx'
import { ScanStopped } from './ScanStopped.tsx'

const route = getRouteApi('/')

const SCANNING_NOTES = { tracks: 'Scanning now', artists: 'Still counting' }

const panelButtonClass = `${ghostActionClass} h-7.5 px-2.75 text-sm`

function photoUrls(details: Readonly<Record<string, SavedArtistDetails>> | undefined): Record<string, string> {
  const photos: Record<string, string> = {}
  for (const [id, record] of Object.entries(details ?? {})) {
    if (record.details?.imageUrl) photos[id] = record.details.imageUrl
  }
  return photos
}

/** The signed-in library: the first scan's progress, a stopped scan, or the ranking with its refresh. */
export function LiveLibrary() {
  const { session, scan, library, details, persistent } = useLibrary()
  const { mode, sort } = route.useSearch()
  const saved = library.data ?? null
  const firstScan = !saved || (scan.status !== 'idle' && scan.kind === 'initial')
  // A finished scan leaves ScanState as plain { status: 'idle' }, with no memory of having run, so remembering the
  // skeleton is the only way to fade the ranking in on arrival rather than on every load with a library saved.
  const [skeletonShown, setSkeletonShown] = useState(false)
  if (firstScan && !skeletonShown) setSkeletonShown(true)

  if (!firstScan && saved) {
    // A refresh never empties the screen: the last ranking stays readable and usable while the new scan runs.
    const refreshing = scan.status === 'scanning'
    const refresh = () => void session.startScan('refresh')
    return (
      <div className={skeletonShown ? 'animate-arrive' : undefined}>
        <RankingView
          library={saved}
          mode={mode}
          sort={sort}
          basePath="/"
          title="Your artist ranking"
          notes={{ tracks: scannedNote(saved.fetchedAt), artists: tiesNote(rankArtists(saved.tracks, mode)) }}
          photos={artistImageUrls(saved.tracks, photoUrls(details.data))}
          stale={refreshing}
          lead={
            <>
              {persistent === false && <StorageNote />}
              {scan.status === 'scanning' && (
                <ScanProgress read={scan.read} total={scan.total} estimateMs={scan.estimateMs} />
              )}
              {scan.status === 'interrupted' && (
                <ScanStopped
                  scan={scan}
                  onResume={() => void session.resumeScan('refresh')}
                  onStartOver={refresh}
                />
              )}
            </>
          }
          panelAction={
            refreshing ? (
              <button type="button" onClick={() => session.cancelScan()} className={panelButtonClass}>
                Cancel
              </button>
            ) : (
              <button type="button" onClick={refresh} className={panelButtonClass}>
                Refresh
              </button>
            )
          }
          emptyState={
            <div className="px-6.5 pt-16 pb-17.5 text-center">
              <p className="text-lg font-semibold">No liked songs to rank</p>
              <p className="mx-auto mt-2 max-w-100 text-base leading-[1.55] text-muted">
                Your Spotify library has no saved tracks. Like a few songs, then refresh.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                <button type="button" onClick={refresh} className={primaryActionClass}>
                  Refresh
                </button>
                <Link to="/demo" className={softActionClass}>
                  See the demo
                </Link>
              </div>
            </div>
          }
        />
      </div>
    )
  }

  const scanning = scan.status === 'scanning'
  return (
    <section aria-labelledby="library-title" className="space-y-4">
      <h1 id="library-title" className="sr-only">
        Your library
      </h1>
      {persistent === false && <StorageNote />}
      {scan.status === 'scanning' && <ScanProgress read={scan.read} total={scan.total} estimateMs={scan.estimateMs} />}
      {scan.status === 'interrupted' && (
        <ScanStopped
          scan={scan}
          onResume={() => void session.resumeScan(scan.kind)}
          onStartOver={() => void session.startScan(scan.kind)}
        />
      )}
      <StatsSummary rankings={[]} trackCount={0} notes={SCANNING_NOTES} pending />
      <ListSkeleton
        still={!scanning}
        header={
          <>
            <h2 className="text-2xs tracking-[0.09em] text-subtle uppercase">Building your ranking</h2>
            <span className="flex-1" />
            {scanning && (
              <button type="button" onClick={() => session.cancelScan()} className={panelButtonClass}>
                Cancel
              </button>
            )}
          </>
        }
      />
    </section>
  )
}

function StorageNote() {
  return (
    <p className="grid grid-cols-[8px_minmax(0,1fr)] items-start gap-2.75 rounded-md border border-border bg-surface px-3.75 py-3.25 text-md leading-[1.55] text-muted">
      <span aria-hidden className="mt-1.5 size-1.75 rounded-full bg-highlight" />
      This browser isn’t letting Listenprint save your library, so it won’t be kept after this tab closes.
    </p>
  )
}
