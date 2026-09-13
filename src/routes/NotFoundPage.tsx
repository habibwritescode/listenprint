import { Link } from '@tanstack/react-router'

export function NotFoundPage() {
  return (
    <section aria-labelledby="not-found-title">
      <h1 id="not-found-title" className="text-3xl font-bold tracking-tight">
        Page not found
      </h1>
      <p className="mt-2 text-muted">There's nothing at this address.</p>
      <Link to="/" className="mt-4 inline-block font-medium text-accent hover:text-accent-bright">
        Back to rankings
      </Link>
    </section>
  )
}
