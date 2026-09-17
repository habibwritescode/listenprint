import { Link } from '@tanstack/react-router'
import type { ScanState } from '../../spotify/scan-machine.ts'
import { ghostActionClass, primaryActionClass } from '../action-styles.ts'
import { interruptionMessage } from './scan-format.ts'

interface ScanStoppedProps {
  scan: Extract<ScanState, { status: 'interrupted' }>
  onResume: () => void
  onStartOver: () => void
}

export function ScanStopped({ scan, onResume, onStartOver }: ScanStoppedProps) {
  return (
    <section role="status" aria-label="Scan stopped" className="rounded-lg border border-border bg-surface px-4.5 py-4">
      <p className="text-base leading-[1.55] text-pretty text-muted">{interruptionMessage(scan)}</p>
      <div className="mt-3.5 flex flex-wrap gap-2.5">
        <button type="button" onClick={onResume} className={primaryActionClass}>
          Resume
        </button>
        <button type="button" onClick={onStartOver} className={ghostActionClass}>
          Start over
        </button>
        {scan.reason === 'forbidden' && (
          <Link to="/demo" className={ghostActionClass}>
            Try the demo
          </Link>
        )}
      </div>
    </section>
  )
}
