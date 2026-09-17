// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { BarChart } from './BarChart.tsx'
import type { ChartBar } from './BarChart.tsx'

afterEach(cleanup)

function month(key: string, label: string, value: number, share: number, tick = ''): ChartBar {
  const saved = value === 0 ? 'no tracks saved' : `${value} tracks saved`
  return { key, label, tick, value, share, name: `${label}, ${saved}`, readout: [] }
}

const months: ChartBar[] = [
  month('2025-01', 'Jan 2025', 40, 0.4, '2025'),
  month('2025-02', 'Feb 2025', 100, 0.6),
  month('2025-03', 'Mar 2025', 0, 0),
]

const genres: ChartBar[] = [
  {
    key: 'indie pop',
    label: 'indie pop',
    value: 184,
    share: 0.184,
    name: 'indie pop, 184 tracks, 18.4% of tagged tracks',
    readout: [
      { label: 'Tracks', value: '184' },
      { label: 'Artists', value: '12' },
      { label: 'Top artist', value: 'Velvet Harbor' },
    ],
  },
  {
    key: 'art rock',
    label: 'art rock',
    value: 141,
    share: 0.141,
    name: 'art rock, 141 tracks, 14.1% of tagged tracks',
    readout: [],
  },
]

function bars() {
  return screen.getAllByRole('button')
}

function renderTimeline(rows = months) {
  return render(<BarChart label="Liked songs by month" layout="columns" bars={rows} valueSuffix="tracks" />)
}

describe('BarChart as columns', () => {
  it('draws a bar per period, sized against the busiest one, with the peak marked', () => {
    const { container } = renderTimeline()
    const [january, february, march] = container.querySelectorAll<HTMLElement>('[data-slot="bar"]')

    expect(january.style.height).toBe('40%')
    expect(february.style.height).toBe('100%')
    // An empty month still draws a sliver, so the axis reads as continuous rather than broken.
    expect(march.style.height).toBe('2%')
    expect(february.dataset.peak).toBe('')
    expect(january.dataset.peak).toBeUndefined()
  })

  it('names every bar for screen readers and labels only the ticks it is given', () => {
    const { container } = renderTimeline()

    expect(bars().map((bar) => bar.getAttribute('aria-label'))).toEqual(months.map((bar) => bar.name))
    expect([...container.querySelectorAll('[data-slot="tick"]')].map((tick) => tick.textContent)).toEqual(['2025'])
  })

  // Ninety bars would be ninety Tab stops; the list model everything else in the app uses is one stop and arrows.
  it('is one Tab stop, with arrows, Home and End moving between bars', async () => {
    const user = userEvent.setup()
    renderTimeline()

    await user.tab()
    expect(document.activeElement).toBe(bars()[1])

    await user.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(bars()[2])
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(document.activeElement).toBe(bars()[0])
    await user.keyboard('{End}')
    expect(document.activeElement).toBe(bars()[2])
    await user.keyboard('{Home}')
    expect(document.activeElement).toBe(bars()[0])

    await user.tab()
    expect(document.activeElement).not.toBe(bars()[1])
  })

  it('shows the peak’s readout until another bar takes over', async () => {
    const user = userEvent.setup()
    const withReadouts = months.map((bar) => ({ ...bar, readout: [{ label: 'Saved', value: String(bar.value) }] }))
    renderTimeline(withReadouts)

    expect(screen.getByTestId('readout').textContent).toContain('Feb 2025')

    await user.hover(bars()[0])
    expect(screen.getByTestId('readout').textContent).toContain('Jan 2025')

    await user.unhover(bars()[0])
    expect(screen.getByTestId('readout').textContent).toContain('Feb 2025')
  })

  it('has no axe violations', async () => {
    const { container } = renderTimeline()
    await expectNoAxeViolations(container)
  })
})

describe('BarChart as rows', () => {
  function renderGenres() {
    return render(<BarChart label="Top genres" layout="rows" bars={genres} valueSuffix="tracks" />)
  }

  it('draws each genre as a row with its own label and share', () => {
    const { container } = renderGenres()
    const [first] = container.querySelectorAll<HTMLElement>('[data-slot="bar"]')

    expect(within(bars()[0]).getByText('indie pop')).toBeDefined()
    expect(first.style.width).toBe('100%')
    expect(container.querySelectorAll<HTMLElement>('[data-slot="bar"]')[1].style.width).toBe('77%')
  })

  it('opens the readout under the focused row', async () => {
    const user = userEvent.setup()
    renderGenres()

    await user.tab()
    expect(document.activeElement).toBe(bars()[0])
    const readout = screen.getByTestId('readout')
    expect(readout.textContent).toContain('Velvet Harbor')
    expect(bars()[0].getAttribute('aria-expanded')).toBe('true')

    await user.keyboard('{ArrowDown}')
    expect(bars()[1].getAttribute('aria-expanded')).toBe('true')
    expect(bars()[0].getAttribute('aria-expanded')).toBe('false')
  })

  it('has no axe violations', async () => {
    const { container } = renderGenres()
    await expectNoAxeViolations(container)
  })
})
