import { Link } from '@tanstack/react-router'

export function RankingsPage() {
  return (
    <section aria-labelledby="rankings-title" className="max-w-2xl">
      <h1 id="rankings-title" className="text-3xl font-bold tracking-tight">
        Your artist rankings
      </h1>
      <p className="mt-3 text-muted">
        Listenprint ranks the artists in your Spotify Liked Songs by how many of their songs you've saved, and
        shows which songs put them there.
      </p>
      <p className="mt-2 text-muted">
        Connecting your Spotify account is coming soon. Until then, explore a generated library of fictional
        artists.
      </p>
      <Link
        to="/demo"
        className="mt-6 inline-block rounded-sm bg-accent px-4 py-2.5 font-semibold text-on-accent transition-colors hover:bg-accent-bright"
      >
        Try the demo
      </Link>
    </section>
  )
}
