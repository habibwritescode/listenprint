import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useSyncExternalStore } from 'react'
import { artistDetailsQueryOptions, libraryQueryOptions } from '../spotify/queries.ts'

const rootRoute = getRouteApi('__root__')

/** The signed-in user's saved library and artist details, the scan's state, and whether the library is kept. */
export function useLibrary() {
  const { library: session } = rootRoute.useRouteContext()
  const scan = useSyncExternalStore(session.subscribe, session.getScanState)
  const persistent = useSyncExternalStore(session.subscribe, session.isPersistent)
  const library = useQuery(libraryQueryOptions(session))
  const details = useQuery(artistDetailsQueryOptions(session))
  return { session, scan, persistent, library, details }
}
