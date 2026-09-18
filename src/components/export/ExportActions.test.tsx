// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { rankArtists } from '../../library/rankings.ts'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { makeArtist, makeTrack } from '../../test/factories.ts'
import { ExportActions } from './ExportActions.tsx'
import type { ExportImageProps } from './ExportImage.tsx'

afterEach(cleanup)

const rankings = rankArtists(
  [
    makeTrack({ artists: [makeArtist({ id: 'a', name: 'Velvet Harbor' })] }),
    makeTrack({ artists: [makeArtist({ id: 'a', name: 'Velvet Harbor' })] }),
    makeTrack({ artists: [makeArtist({ id: 'b', name: 'Static Choir' })] }),
  ],
  'all',
)

function renderActions(overrides: Partial<Parameters<typeof ExportActions>[0]> = {}) {
  const download = vi.fn<(name: string, blob: Blob) => void>()
  const view = render(
    <ExportActions
      rankings={rankings}
      trackCount={3}
      source="demo"
      filtered={false}
      now={new Date('2026-09-17T10:00:00Z')}
      download={download}
      {...overrides}
    />,
  )
  return { ...view, download }
}

async function textOf(blob: Blob) {
  return blob.text()
}

describe('ExportActions', () => {
  it('says what each export will contain', () => {
    renderActions()

    expect(screen.getByRole('button', { name: /Download CSV/ })).toBeDefined()
    expect(screen.getByRole('button', { name: /Download PNG/ })).toBeDefined()
    expect(screen.getByText(/all 2 artists/)).toBeDefined()
  })

  // A filtered export is never a surprise: the row says how many rows will be in the file.
  it('names the filtered count when the list is filtered', () => {
    renderActions({ filtered: true })

    expect(screen.getByText(/the 2 artists shown/)).toBeDefined()
  })

  it('writes the current view as CSV, named for the day', async () => {
    const user = userEvent.setup()
    const { download } = renderActions()

    await user.click(screen.getByRole('button', { name: /Download CSV/ }))

    await waitFor(() => expect(download).toHaveBeenCalled())
    const [name, blob] = download.mock.calls[0]
    expect(name).toBe('sample-listenprint-top-artists-2026-09-17.csv')
    expect(await textOf(blob)).toContain('Velvet Harbor')
    expect(blob.type).toContain('text/csv')
  })

  it('renders the square, downloads it, and says so while it works', async () => {
    const user = userEvent.setup()
    let release: (blob: Blob) => void = () => {}
    const pending = new Promise<Blob>((resolve) => {
      release = resolve
    })
    const createImage = vi.fn<(props: ExportImageProps) => Promise<Blob>>(() => pending)
    const { download } = renderActions({ createImage })

    await user.click(screen.getByRole('button', { name: 'Download PNG' }))

    expect(await screen.findByRole('button', { name: 'Preparing image…' })).toHaveProperty('disabled', true)
    expect(createImage.mock.calls[0][0]).toMatchObject({
      sample: true,
      share: '100%',
      trackCount: '3',
      stamp: '17 SEP 2026 · SAMPLE LIBRARY',
    })
    expect(createImage.mock.calls[0][0].rows.map((row) => row.name)).toEqual(['Velvet Harbor', 'Static Choir'])

    release(new Blob(['png'], { type: 'image/png' }))

    await waitFor(() => expect(download).toHaveBeenCalled())
    expect(download.mock.calls[0][0]).toBe('sample-listenprint-top-artists-2026-09-17.png')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download PNG' })).toHaveProperty('disabled', false))
  })

  // A silent failure would look like a broken button; the row says what happened and stays usable.
  it('states a failure and lets the button be used again', async () => {
    const user = userEvent.setup()
    renderActions({ createImage: () => Promise.reject(new Error('canvas said no')) })

    await user.click(screen.getByRole('button', { name: 'Download PNG' }))

    expect(await screen.findByText('The image couldn’t be created. Try again.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Download PNG' })).toHaveProperty('disabled', false)
  })

  it('offers nothing to export for an empty ranking', () => {
    const { container } = renderActions({ rankings: [] })

    expect(container.textContent).toBe('')
  })

  it('has no axe violations', async () => {
    const { container } = renderActions()
    await expectNoAxeViolations(container)
  })
})
