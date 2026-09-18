import { useState } from 'react'
import { exportFileName, exportRows, toCsv } from '../../library/export.ts'
import { shareOfLibrary } from '../../library/presentation.ts'
import type { ArtistRanking, Library } from '../../library/types.ts'
import type { ExportImageProps } from './ExportImage.tsx'
import { ghostActionClass, softActionClass } from '../action-styles.ts'
import { downloadFile } from './download.ts'
import type { DownloadFile } from './download.ts'

interface ExportActionsProps {
  /** The view's rankings: the filter, mode and sort the list is showing. */
  rankings: readonly ArtistRanking[]
  trackCount: number
  source: Library['source']
  /** A filtered view exports what it shows, and the row says so. */
  filtered: boolean
  /** Injected, so tests can pin the date in a file name. */
  now?: Date
  download?: DownloadFile
  /** Injected in tests; by default the square and `html-to-image` are fetched on the first click. */
  createImage?: (props: ExportImageProps) => Promise<Blob>
}

async function renderSquare(props: ExportImageProps): Promise<Blob> {
  const { renderExportImage } = await import('./render-image.tsx')
  return renderExportImage(props)
}

const countFormat = new Intl.NumberFormat()
// Day first, as the design's stamp reads, and en-US for a short September of SEP rather than SEPT.
const stampParts = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

function imageStamp(now: Date, source: Library['source']): string {
  const parts = Object.fromEntries(stampParts.formatToParts(now).map((part) => [part.type, part.value]))
  const date = `${parts.day} ${parts.month} ${parts.year}`.toUpperCase()
  return source === 'demo' ? `${date} · SAMPLE LIBRARY` : date
}

/**
 * Both exports of the ranked list: a square image to share, and every row as a spreadsheet. It sits above the list,
 * since a library of a thousand artists is tall enough that nothing below the rows is ever seen.
 */
export function ExportActions(props: ExportActionsProps) {
  const { rankings, trackCount, source, filtered, now = new Date(), download = downloadFile } = props
  const { createImage = renderSquare } = props
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  if (rankings.length === 0) return null

  const artists = `${countFormat.format(rankings.length)} artist${rankings.length === 1 ? '' : 's'}`
  const scope = filtered ? `the ${artists} shown` : `all ${artists}`

  const downloadCsv = () => {
    setError(null)
    try {
      const csv = toCsv(rankings, trackCount)
      download(exportFileName('csv', source, now), new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    } catch {
      setError('The spreadsheet couldn’t be created. Try again.')
    }
  }

  const rows = exportRows(rankings)
  const shared = rows.reduce((total, row) => total + row.count, 0)

  const downloadPng = async () => {
    setError(null)
    setWorking(true)
    try {
      const blob = await createImage({
        rows,
        share: `${Math.round(shareOfLibrary(shared, trackCount) * 100)}%`,
        trackCount: countFormat.format(trackCount),
        stamp: imageStamp(now, source),
        sample: source === 'demo',
      })
      download(exportFileName('png', source, now), blob)
    } catch {
      setError('The image couldn’t be created. Try again.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <section aria-labelledby="export-title" className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h2 id="export-title" className="sr-only">
        Take it with you
      </h2>
      <button type="button" onClick={() => void downloadPng()} disabled={working} className={softActionClass}>
        {working ? 'Preparing image…' : 'Download PNG'}
      </button>
      <button type="button" onClick={downloadCsv} className={ghostActionClass}>
        Download CSV
      </button>
      <p className="text-sm text-muted">{`Your top 20 as an image · ${scope} as a spreadsheet`}</p>
      {error && <p className="basis-full text-sm text-highlight">{error}</p>}
    </section>
  )
}
