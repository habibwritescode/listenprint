import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { ArtistView } from '../components/artists/ArtistView.tsx'
import { demoLibraryQueryOptions } from '../demo/demo-library-query.ts'

const route = getRouteApi('/demo/artist/$artistId')

export function DemoArtistPage() {
  const { artist } = route.useLoaderData()
  const { mode, sort } = route.useSearch()
  const { data: library } = useSuspenseQuery(demoLibraryQueryOptions)

  return (
    <ArtistView
      library={library}
      artist={artist}
      mode={mode}
      sort={sort}
      basePath="/demo"
      libraryName="Sample library"
    />
  )
}
