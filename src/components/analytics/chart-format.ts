/** Bars keep a sliver at zero, so an empty period reads as a gap in a continuous axis rather than a missing bar. */
const MIN_BAR_PERCENT = 2

export function barLengthPercent(value: number, max: number): number {
  if (max <= 0) return MIN_BAR_PERCENT
  return Math.max(MIN_BAR_PERCENT, Math.round((value / max) * 100))
}
