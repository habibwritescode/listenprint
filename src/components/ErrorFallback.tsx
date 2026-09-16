import { useState } from 'react'
import { Notice } from './Notice.tsx'
import { ghostActionClass, primaryActionClass } from './action-styles.ts'

interface ErrorFallbackProps {
  error: unknown
}

function errorSummary(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

// The path only: a callback URL's query string carries a sign-in code.
function errorDetails(error: unknown): string {
  const trace = error instanceof Error && error.stack ? error.stack : errorSummary(error)
  return `${trace}\n\nPage: ${window.location.pathname}`
}

type CopyResult = 'copied' | 'failed' | null

// Shared by the router's defaultErrorComponent and AppErrorBoundary. It can render outside the router, so it uses
// plain anchors rather than the router's <Link>.
export function ErrorFallback({ error }: ErrorFallbackProps) {
  const [copyResult, setCopyResult] = useState<CopyResult>(null)

  const copyDetails = () => {
    navigator.clipboard.writeText(errorDetails(error)).then(
      () => setCopyResult('copied'),
      () => setCopyResult('failed'),
    )
  }

  return (
    <Notice
      align="start"
      tone="attention"
      kicker="Something broke"
      title="Listenprint hit an error and stopped."
      body="This is a bug in the app, not a problem with your library or your account. Listenprint has no server, so reloading starts clean and nothing is left in a bad state on Spotify’s side."
      body2="If it keeps happening, the details below are what a bug report needs."
      detail={errorSummary(error)}
    >
      <button type="button" onClick={() => window.location.reload()} className={primaryActionClass}>
        Reload the app
      </button>
      <button type="button" onClick={copyDetails} className={ghostActionClass}>
        Copy error details
      </button>
      <a href="/demo" className={ghostActionClass}>
        Open the demo
      </a>
      <p role="status" className="basis-full text-sm text-subtle empty:hidden">
        {copyResult === 'copied' && 'Error details copied.'}
        {copyResult === 'failed' && 'Couldn’t copy. Select the error text above instead.'}
      </p>
    </Notice>
  )
}
