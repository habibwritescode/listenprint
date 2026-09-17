import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { ArtistView } from '../components/artists/ArtistView.tsx'
import { demoGenresQueryOptions, demoLibraryQueryOptions } from '../demo/demo-library-query.ts'

const route = getRouteApi('/demo/artist/$artistId')

export function DemoArtistPage() {
  const { artist } = route.useLoaderData()
  const { mode, sort } = route.useSearch()
  const { data: library } = useSuspenseQuery(demoLibraryQueryOptions)
  const { data: genres } = useSuspenseQuery(demoGenresQueryOptions)

  return (
    <ArtistView
      library={library}
      artist={artist}
      mode={mode}
      sort={sort}
      basePath="/demo"
      libraryName="Sample library"
      genres={genres.get(artist.id)}
      noGenresNote="No genre tags — this sample artist has none"
    />
  )
}
