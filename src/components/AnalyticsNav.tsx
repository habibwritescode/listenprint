import { Link } from '@tanstack/react-router'
import type { SortOrder } from '../library/presentation.ts'
import type { RankingMode } from '../library/types.ts'
import type { LibraryBase } from './artists/library-paths.ts'

interface AnalyticsNavProps {
  basePath: LibraryBase
  /** Carried between views, so switching never resets the ranking mode. */
  search: { mode: RankingMode; sort: SortOrder }
}

const linkClass =
  'flex h-9 items-center rounded-t-sm text-base tracking-[-0.01em] text-subtle transition-colors hover:text-text ' +
  'shadow-[inset_0_-2px_0_transparent] aria-[current=page]:font-medium aria-[current=page]:text-text ' +
  'aria-[current=page]:shadow-[inset_0_-2px_0_var(--color-accent)]'

// The router marks the current link, but only exactly: without this the ranking would stay marked on /demo/genres,
// which starts with /demo. Search is left out because the timeline's grain is stripped from the URL at its default.
const activeOptions = { exact: true, includeSearch: false } as const

/** The three views of one library. It sits under the wordmark on list and chart pages; artist pages keep a back link. */
export function AnalyticsNav({ basePath, search }: AnalyticsNavProps) {
  const genres = basePath === '/demo' ? '/demo/genres' : '/genres'
  const timeline = basePath === '/demo' ? '/demo/timeline' : '/timeline'

  return (
    <nav aria-label="Library views" className="order-last flex w-full gap-5 border-t border-border pt-1">
      <Link to={basePath} search={search} activeOptions={activeOptions} className={linkClass}>
        Artists
      </Link>
      <Link to={genres} search={search} activeOptions={activeOptions} className={linkClass}>
        Genres
      </Link>
      <Link
        to={timeline}
        search={{ ...search, grain: 'month' }}
        activeOptions={activeOptions}
        className={linkClass}
      >
        Timeline
      </Link>
    </nav>
  )
}
