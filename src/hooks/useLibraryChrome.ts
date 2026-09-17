import { useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useSyncExternalStore } from 'react'
import { LIBRARY_QUERY_KEY } from '../spotify/queries.ts'

const rootRoute = getRouteApi('__root__')

/**
 * What the header needs from the signed-in library: whether a ranking is loaded, and whether a refresh is replacing
 * it. Reads the query cache directly rather than through `useQuery`, which would put Query's observers in the main
 * bundle.
 */
export function useLibraryChrome() {
  const queryClient = useQueryClient()
  const { library } = rootRoute.useRouteContext()
  const hasLibrary = useSyncExternalStore(
    (onChange) => queryClient.getQueryCache().subscribe(onChange),
    () => Boolean(queryClient.getQueryData(LIBRARY_QUERY_KEY)),
  )
  const refreshing = useSyncExternalStore(library.subscribe, () => {
    const scan = library.getScanState()
    return scan.status === 'scanning' && scan.kind === 'refresh'
  })
  return { hasLibrary, refreshing }
}
