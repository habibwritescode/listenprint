import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { rovingTargetIndex } from '../../hooks/roving-focus.ts'
import { barLengthPercent } from './chart-format.ts'

export interface ReadoutItem {
  label: string
  value: string
}

export interface ChartBar {
  key: string
  /** Shown beside the bar in rows; only in the readout in columns, where 90 labels wouldn't fit. */
  label: string
  /** The axis label under a column, empty for columns between ticks. */
  tick?: string
  value: number
  /** Share of this bar's own denominator, which the caller names in `readout`. */
  share: number
  /** The whole readout as one sentence: what a screen reader gets instead of the drawn bar. */
  name: string
  readout: ReadoutItem[]
}

interface BarChartProps {
  /** Names the chart for assistive technology. */
  label: string
  /** `columns` for periods across an axis, `rows` for a ranked list of shares. */
  layout: 'columns' | 'rows'
  bars: ChartBar[]
  /** The unit in the readout's headline figure, e.g. `tracks`. */
  valueSuffix: string
}

const numberFormat = new Intl.NumberFormat()

function peakIndex(bars: readonly ChartBar[]): number {
  return bars.reduce((leader, bar, index) => (bar.value > bars[leader].value ? index : leader), 0)
}

interface ReadoutProps {
  bar: ChartBar
  valueSuffix: string
  columns: boolean
  /** Where the bar's top sits, so the readout can stay inside the chart box. */
  barPercent: number
  /** Which end of the chart the bar is at, so the readout never spills past its edge. */
  edge: 'start' | 'end' | 'middle'
}

/** Past this height there is no room above the bar, so the readout sits over the bar's own top instead. */
const READOUT_OVER_BAR_PERCENT = 65

function Readout({ bar, valueSuffix, columns, barPercent, edge }: ReadoutProps) {
  const tall = barPercent > READOUT_OVER_BAR_PERCENT
  const sides = edge === 'start' ? 'left-0' : edge === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2'
  return (
    <div
      data-testid="readout"
      aria-hidden
      style={columns ? (tall ? { top: 4 } : { bottom: `calc(${barPercent}% + 6px)` }) : undefined}
      className={`pointer-events-none z-10 rounded-md border border-border bg-surface px-3 py-2 ${
        columns ? `absolute whitespace-nowrap ${sides}` : 'mt-2 w-full'
      }`}
    >
      <p className="text-2xs tracking-[0.12em] text-subtle uppercase tabular-nums">{bar.label}</p>
      <p className="mt-1 text-lg tabular-nums">
        {numberFormat.format(bar.value)} <span className="text-sm text-muted">{valueSuffix}</span>
      </p>
      {bar.readout.length > 0 && (
        <dl className={`mt-2 gap-x-5 gap-y-1 text-sm ${columns ? 'flex' : 'grid grid-cols-[auto_1fr]'}`}>
          {bar.readout.map((item) => (
            <div key={item.label} className={columns ? '' : 'contents'}>
              <dt className="text-2xs tracking-[0.12em] text-subtle uppercase">{item.label}</dt>
              <dd className="tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

/**
 * The genre and timeline charts: plain elements sized with inline style, no charting library. One Tab stop with arrow
 * keys, because a monthly timeline is ninety bars and ninety Tab stops would be unusable; each bar carries its whole
 * readout as its accessible name, so the chart reads without being seen.
 */
export function BarChart({ label, layout, bars, valueSuffix }: BarChartProps) {
  const columns = layout === 'columns'
  const peak = peakIndex(bars)
  const [activeIndex, setActiveIndex] = useState(peak)
  // null falls back to the peak, which is the bar the chart opens on.
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const max = bars.reduce((largest, bar) => Math.max(largest, bar.value), 0)
  const shown = selectedIndex ?? peak

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const index = rovingTargetIndex(event.key, activeIndex, bars.length, columns ? 'horizontal' : 'vertical')
    if (index === null) return
    event.preventDefault()
    listRef.current?.querySelectorAll('button')[index]?.focus()
  }

  return (
    <div className={columns ? 'relative' : ''}>
      <ul
        ref={listRef}
        aria-label={label}
        onKeyDown={onKeyDown}
        className={columns ? 'flex h-60 items-end gap-px' : 'space-y-3.5'}
      >
        {bars.map((bar, index) => {
          const length = `${barLengthPercent(bar.value, max)}%`
          return (
            <li key={bar.key} className={columns ? 'relative flex h-full flex-1 items-end' : ''}>
              {shown === index && columns && (
                <Readout
                  bar={bar}
                  valueSuffix={valueSuffix}
                  columns
                  barPercent={barLengthPercent(bar.value, max)}
                  edge={index < 2 ? 'start' : index > bars.length - 3 ? 'end' : 'middle'}
                />
              )}
              <button
                type="button"
                aria-label={bar.name}
                aria-expanded={shown === index}
                tabIndex={index === activeIndex ? 0 : -1}
                onFocus={() => {
                  setActiveIndex(index)
                  setSelectedIndex(index)
                }}
                onBlur={() => setSelectedIndex(null)}
                onMouseEnter={() => setSelectedIndex(index)}
                onMouseLeave={() => setSelectedIndex(null)}
                className={columns ? 'flex h-full w-full items-end rounded-sm' : 'block w-full rounded-sm text-left'}
              >
                {!columns && (
                  <span aria-hidden className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="truncate text-base">{bar.label}</span>
                    <span className="text-sm text-muted tabular-nums">{(bar.share * 100).toFixed(1)}%</span>
                  </span>
                )}
                <span
                  aria-hidden
                  data-slot="bar"
                  data-peak={index === peak ? '' : undefined}
                  style={columns ? { height: length } : { width: length }}
                  className={`block ${columns ? 'w-full rounded-t-xs' : 'h-2.5 rounded-full'} ${
                    index === peak ? 'bg-chart-peak' : 'bg-chart-fill'
                  }`}
                />
              </button>
              {shown === index && !columns && (
                <Readout bar={bar} valueSuffix={valueSuffix} columns={false} barPercent={0} edge="middle" />
              )}
            </li>
          )
        })}
      </ul>
      {columns && (
        <div aria-hidden className="mt-2 flex gap-px">
          {bars.map((bar) =>
            bar.tick ? (
              <span key={bar.key} data-slot="tick" className="flex-1 text-2xs text-subtle tabular-nums">
                {bar.tick}
              </span>
            ) : (
              <span key={bar.key} className="flex-1" />
            ),
          )}
        </div>
      )}
    </div>
  )
}
