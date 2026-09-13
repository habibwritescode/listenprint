import { getRouteApi } from '@tanstack/react-router'

const route = getRouteApi('/artist/$artistId')

export function ArtistPage() {
  const { artistId } = route.useParams()

  return (
    <section aria-labelledby="artist-title">
      <h1 id="artist-title" className="text-3xl font-bold tracking-tight">
        Artist
      </h1>
      <p className="mt-2 text-muted">
        Details for <code className="text-text">{artistId}</code>. Coming soon.
      </p>
    </section>
  )
}
