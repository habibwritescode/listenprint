import { Suspense, lazy } from 'react'
import { useLibrary } from '../../hooks/useLibrary.ts'
import { ScanInvitation } from './ScanInvitation.tsx'

// The list and stats pull in the virtualizer, which someone who hasn't scanned yet doesn't need.
const LiveLibrary = lazy(() => import('./LiveLibrary.tsx').then((module) => ({ default: module.LiveLibrary })))

export function SignedInHome({ displayName }: { displayName: string }) {
  const { session, scan, library } = useLibrary()

  // Reading the saved library takes a moment; showing the invitation first would flash it for returning users.
  if (library.isPending) return null
  if (!library.data && scan.status === 'idle') {
    return <ScanInvitation displayName={displayName} onScan={() => session.startScan('initial')} />
  }
  return (
    <Suspense fallback={null}>
      <LiveLibrary />
    </Suspense>
  )
}
