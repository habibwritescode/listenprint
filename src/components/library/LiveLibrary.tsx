import { getRouteApi } from '@tanstack/react-router'
import { useLibrary } from '../../hooks/useLibrary.ts'
import { ghostActionClass } from '../action-styles.ts'
import { ListSkeleton } from '../artists/ListSkeleton.tsx'
import { RankingView } from '../artists/RankingView.tsx'
import { StatsSummary } from '../artists/StatsSummary.tsx'
import { ScanProgress } from './ScanProgress.tsx'
import { ScanStopped } from './ScanStopped.tsx'

const route = getRouteApi('/')

const SCANNING_NOTES = { tracks: 'Scanning now', artists: 'Still counting' }

/** The signed-in library: the first scan's progress, a stopped scan, or the ranking. */
export function LiveLibrary() {
  const { session, scan, library } = useLibrary()
  const { mode, sort } = route.useSearch()
  const saved = library.data ?? null

  if (saved && !(scan.status !== 'idle' && scan.kind === 'initial')) {
    return (
      <RankingView
        library={saved}
        mode={mode}
        sort={sort}
        basePath="/"
        title="Your artist ranking"
        notes={{ tracks: 'Your liked songs', artists: 'In your library' }}
      />
    )
  }

  const scanning = scan.status === 'scanning'
  return (
    <section aria-labelledby="library-title" className="space-y-4">
      <h1 id="library-title" className="sr-only">
        Your library
      </h1>
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
              <button type="button" onClick={() => session.cancelScan()} className={`${ghostActionClass} h-7.5 px-2.75 text-sm`}>
                Cancel
              </button>
            )}
          </>
        }
      />
    </section>
  )
}
