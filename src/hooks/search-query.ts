import { createContext, useContext } from 'react'

export interface SearchQuery {
  /** What the field holds right now, which runs ahead of the URL while typing. */
  query: string
  setQuery: (query: string) => void
}

const SearchQueryContext = createContext<SearchQuery>({ query: '', setQuery: () => {} })

export const SearchQueryProvider = SearchQueryContext.Provider

/** The live artist filter, shared by the header's field and the ranked list in the page below it. */
export function useSearchQuery(): SearchQuery {
  return useContext(SearchQueryContext)
}
