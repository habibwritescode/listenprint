// @vitest-environment jsdom
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

const ROW_HEIGHT = 40
const ROW_COUNT = 2_000

// React Compiler caches getVirtualItems() against the virtualizer instance, which never changes, so a
// compiled list keeps its first-render rows forever. Verified: compiled, this list rendered no rows, and
// with initialRect set it rendered rows that never changed on scroll. Every virtualized list needs this.
function ProbeList() {
  'use no memo'
  const virtualizer = useWindowVirtualizer({ count: ROW_COUNT, estimateSize: () => ROW_HEIGHT, overscan: 5 })

  return (
    <ul style={{ position: 'relative', height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((item) => (
        <li
          key={item.key}
          data-index={item.index}
          style={{ position: 'absolute', top: 0, transform: `translateY(${item.start}px)` }}
        >
          Row {item.index}
        </li>
      ))}
    </ul>
  )
}

function renderedIndexes() {
  return screen.getAllByRole('listitem').map((row) => Number(row.dataset.index))
}

function scrollWindowTo(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
  window.dispatchEvent(new Event('scroll'))
}

afterEach(() => {
  cleanup()
  scrollWindowTo(0)
})

describe('useWindowVirtualizer under jsdom with React Compiler opted out', () => {
  it('renders only a window of rows', () => {
    render(<ProbeList />)

    const rendered = renderedIndexes()

    expect(rendered.length).toBeGreaterThan(0)
    expect(rendered.length).toBeLessThan(ROW_COUNT)
  })

  it('renders different rows after the window scrolls', async () => {
    render(<ProbeList />)
    const before = renderedIndexes()

    await act(async () => {
      scrollWindowTo(ROW_HEIGHT * 1_000)
    })

    const after = renderedIndexes()
    expect(Math.min(...after)).toBeGreaterThan(Math.max(...before))
    expect(after).toContain(1_000)
  })
})
