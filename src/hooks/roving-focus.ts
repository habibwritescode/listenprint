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
