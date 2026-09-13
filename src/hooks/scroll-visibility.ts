/** Smaller moves (trackpad jitter, momentum settling) never toggle the header, so it doesn't flicker. */
export const SCROLL_TOLERANCE = 4

export function nextHeaderHidden(hidden: boolean, previousY: number, currentY: number, headerHeight: number): boolean {
  if (currentY <= headerHeight) return false
  const delta = currentY - previousY
  if (delta > SCROLL_TOLERANCE) return true
  if (delta < -SCROLL_TOLERANCE) return false
  return hidden
}

export function headerHasBackground(scrollY: number): boolean {
  return scrollY > 0
}

export function shouldShowBackToTop(scrollY: number, viewportHeight: number): boolean {
  return scrollY > viewportHeight
}
