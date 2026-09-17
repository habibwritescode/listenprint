import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Notice } from '../Notice.tsx'
import { ghostActionClass, primaryActionClass } from '../action-styles.ts'
import { ListSkeleton } from '../artists/ListSkeleton.tsx'

interface ScanInvitationProps {
  displayName: string
  onScan: () => Promise<void>
}

// Scanning is an explicit action, with its cost stated first. The rows below show the shape of what's coming, at the
// real row height, so nothing jumps when data arrives.
export function ScanInvitation({ displayName, onScan }: ScanInvitationProps) {
  const [failed, setFailed] = useState(false)

  const scan = () => {
    setFailed(false)
    // Rejects only when the scan's code can't be downloaded, such as offline.
    onScan().catch(() => setFailed(true))
  }

  return (
    <div>
      <Notice
        align="start"
        tone="neutral"
        kicker="Ready"
        title={`Connected as ${displayName}.`}
        body="Your library hasn’t been read yet. The scan reads your Liked Songs 50 at a time and saves them in this browser, so your ranking loads straight away next time. Signing out deletes them."
        meta="About 40 seconds for a 10,000-track library"
      >
        <button type="button" onClick={scan} className={primaryActionClass}>
          Scan my library
        </button>
        <Link to="/demo" className={ghostActionClass}>
          Try the demo
        </Link>
        {failed && (
          <p role="alert" className="basis-full text-sm text-highlight">
            Couldn’t start the scan. Check your connection and try again.
          </p>
        )}
      </Notice>
      <ListSkeleton still />
    </div>
  )
}
