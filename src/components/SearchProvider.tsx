import { useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { SearchQueryProvider } from '../hooks/search-query.ts'

function urlQueryOf(search: Record<string, unknown>): string {
  return typeof search.q === 'string' ? search.q : ''
}

/**
 * Holds the artist filter while it's being typed, so the list redraws on every keystroke and the URL only catches up
 * once typing stops. A query arriving from the URL — a pasted link, Back, a cleared filter — takes over again.
 */
export function SearchProvider({ children }: { children: ReactNode }) {
  const urlQuery = useRouterState({ select: (state) => urlQueryOf(state.location.search) })
  const [query, setQuery] = useState(urlQuery)
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery)

  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery)
    setQuery(urlQuery)
  }

  return <SearchQueryProvider value={{ query, setQuery }}>{children}</SearchQueryProvider>
}
