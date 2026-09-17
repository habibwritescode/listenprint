import { Link, useLocation, useRouter } from '@tanstack/react-router'
import type { MouseEvent, ReactNode } from 'react'
import type { SortOrder } from '../library/presentation.ts'
import type { RankingMode } from '../library/types.ts'
import type { LibraryBase } from './artists/library-paths.ts'

interface BackToRankingProps {
  basePath: LibraryBase
  search: { mode: RankingMode; sort: SortOrder }
  className?: string
  children?: ReactNode
}

const backLinkClass = 'rounded-md px-1 text-md text-muted transition-colors hover:text-text'

/**
 * Goes back through history when the artist page was opened from the ranking, so the router restores the list's scroll
 * position; a new history entry would start a list of thousands of rows at the top. Opened any other way (a shared
 * link, a new tab), it links to the ranking as usual. Modified clicks keep the link's own behaviour.
 */
export function BackToRanking({ basePath, search, className = backLinkClass, children }: BackToRankingProps) {
  const router = useRouter()
  const { state } = useLocation()

  const goBack = (event: MouseEvent<HTMLAnchorElement>) => {
    const plainClick = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
    if (!plainClick || !state.fromRanking || !router.history.canGoBack()) return
    event.preventDefault()
    router.history.back()
  }

  return (
    <Link to={basePath} search={search} onClick={goBack} className={className}>
      {children ?? (
        <>
          <span aria-hidden>← </span>Back to ranking
        </>
      )}
    </Link>
  )
}
