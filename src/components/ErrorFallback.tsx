interface ErrorFallbackProps {
  error: unknown
  reset: () => void
}

// Shared by the router's defaultErrorComponent and AppErrorBoundary. It can render
// outside the router, so it uses a plain anchor rather than the router's <Link>.
export function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  const message = error instanceof Error ? error.message : String(error)

  return (
    <section role="alert" aria-labelledby="error-title" className="mx-auto max-w-xl px-4 py-16">
      <h1 id="error-title" className="text-3xl font-bold tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-2 text-muted">
        Listenprint hit an unexpected error. Try again, or head back to the start.
      </p>
      {import.meta.env.DEV && (
        <pre className="mt-4 overflow-x-auto rounded-md border border-border bg-surface p-3 text-sm text-subtle">
          {message}
        </pre>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={reset}
          className="rounded-sm bg-accent px-4 py-2 font-semibold text-on-accent hover:bg-accent-bright"
        >
          Try again
        </button>
        <a href="/" className="font-medium text-accent hover:text-accent-bright">
          Back to rankings
        </a>
      </div>
    </section>
  )
}
