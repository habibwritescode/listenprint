export function rovingTargetIndex(key: string, currentIndex: number, count: number): number | null {
  if (count === 0) return null
  switch (key) {
    case 'ArrowDown':
      return Math.min(currentIndex + 1, count - 1)
    case 'ArrowUp':
      return Math.max(currentIndex - 1, 0)
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}

/**
 * The rows to render: the virtualizer's range plus rows that must stay in the page, such as the focused row. A focused
 * row that unmounts drops focus to <body>, and the next row focused from script then gets no keyboard focus ring.
 */
export function withKeptRows(range: readonly number[], kept: readonly (number | null)[], count: number): number[] {
  const rows = new Set(range)
  for (const index of kept) {
    if (index !== null && index >= 0 && index < count) rows.add(index)
  }
  return [...rows].sort((a, b) => a - b)
}

/** The active row while it's rendered; otherwise the first rendered row keeps the list reachable with Tab. */
export function tabbableRowIndex(activeIndex: number, renderedIndexes: readonly number[]): number {
  return renderedIndexes.includes(activeIndex) ? activeIndex : (renderedIndexes[0] ?? -1)
}
