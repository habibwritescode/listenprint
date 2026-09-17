import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useLibrary } from '../../hooks/useLibrary.ts'
import type { Library } from '../../library/types.ts'
import { Notice } from '../Notice.tsx'
import { ghostActionClass, primaryActionClass, softActionClass } from '../action-styles.ts'

interface LiveAnalyticsProps {
  /** Names the view in the states that have no chart to show, e.g. "break down" or "chart". */
  verb: string
  children: (library: Library) => ReactNode
}

/**
 * The states a chart page reaches before there's a library to chart. Both chart routes are deep-linkable, so someone
 * can land here before scanning; the same screen backs each with one word changed.
 */
export function LiveAnalytics({ verb, children }: LiveAnalyticsProps) {
  const { session, scan, library } = useLibrary()

  if (library.isPending) return null

  const saved = library.data ?? null
  if (saved) return <>{children(saved)}</>

  if (scan.status === 'scanning') {
    return (
      <Notice
        align="start"
        tone="neutral"
        kicker="Scanning now"
        title="Your library is still being read."
        body="This view needs the whole library, so it waits for the scan to finish. Progress is on the home page, and nothing is lost if you stay here."
      >
        <Link to="/" className={primaryActionClass}>
          See the progress
        </Link>
      </Notice>
    )
  }

  return (
    <Notice
      align="start"
      tone="neutral"
      kicker="Nothing loaded yet"
      title={`There’s no library to ${verb} yet.`}
      body="Listenprint reads your liked songs once and saves them in this browser, and there’s nothing saved here yet. Scanning takes about forty seconds for a 10,000-track library, and this view will be waiting when it finishes."
    >
      <button type="button" onClick={() => void session.startScan('initial')} className={primaryActionClass}>
        Scan my library
      </button>
      <Link to="/demo" className={softActionClass}>
        See it on the sample library
      </Link>
    </Notice>
  )
}

/** Shown on both chart routes while signed out, where there is no library to read at all. */
export function SignedOutAnalytics({ verb }: { verb: string }) {
  return (
    <Notice
      tone="neutral"
      kicker="Signed out"
      title={`This page needs your Spotify library.`}
      body={`There’s nothing to ${verb} while you’re signed out, since Listenprint reads your liked songs into this browser only after you connect. The sample library shows the same view with made-up data.`}
    >
      <Link to="/" className={primaryActionClass}>
        Go to the home page
      </Link>
      <Link to="/demo" className={ghostActionClass}>
        Open the demo
      </Link>
    </Notice>
  )
}
