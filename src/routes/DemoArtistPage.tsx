import { getRouteApi } from '@tanstack/react-router'

const route = getRouteApi('/demo/artist/$artistId')

export function DemoArtistPage() {
  const { artist } = route.useLoaderData()

  return (
    <section aria-labelledby="artist-title">
      <h1 id="artist-title" className="text-3xl font-bold tracking-tight">
        {artist.name}
      </h1>
    </section>
  )
}
