import { queryOptions } from '@tanstack/react-query'
import type { LibrarySession } from './library-session.ts'

// Keys name the data, never the account or a token.
export const LIBRARY_QUERY_KEY = ['library', 'spotify'] as const
export const ARTIST_DETAILS_QUERY_KEY = ['artist-details', 'spotify'] as const

// Saved data changes only when a scan or sign-out writes it, and those update the cache themselves.
export function libraryQueryOptions(session: LibrarySession) {
  return queryOptions({
    queryKey: LIBRARY_QUERY_KEY,
    queryFn: () => session.loadLibrary(),
    staleTime: Infinity,
    retry: false,
  })
}

export function artistDetailsQueryOptions(session: LibrarySession) {
  return queryOptions({
    queryKey: ARTIST_DETAILS_QUERY_KEY,
    queryFn: () => session.loadArtistDetails(),
    staleTime: Infinity,
    retry: false,
  })
}
