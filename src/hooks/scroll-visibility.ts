/** Smaller moves (trackpad jitter, momentum settling) never toggle the header, so it doesn't flicker. */
export const SCROLL_TOLERANCE = 4

export function nextHeaderHidden(hidden: boolean, previousY: number, currentY: number, headerHeight: number): boolean {
  if (currentY <= headerHeight) return false
  const delta = currentY - previousY
  if (delta > SCROLL_TOLERANCE) return true
  if (delta < -SCROLL_TOLERANCE) return false
  return hidden
}

/** How long after a new page renders a scroll still counts as the router resetting or restoring its position. */
export const ARRIVAL_SETTLE_MS = 300

/**
 * Whether a scroll belongs to arriving on a page: the router's reset or restore, or a virtualized list starting at the
 * restored offset. `renderedAt` is null until the new page has rendered.
 */
export function isArrivalScroll(pageChanged: boolean, renderedAt: number | null, now: number): boolean {
  return pageChanged && (renderedAt === null || now - renderedAt <= ARRIVAL_SETTLE_MS)
}

/**
 * The header after the first scroll that follows a page change. That scroll is the router resetting or restoring the
 * position, often thousands of pixels in one jump, not someone scrolling, so it never reads as scrolling up.
 *
 * `remembered` is the header this history entry had when it was last left, so Back to a list that was scrolled past
 * the header returns it as it was rather than handing back a header the reader had already scrolled away.
 */
export function headerHiddenOnArrival(
  remembered: boolean | undefined,
  hidden: boolean,
  currentY: number,
  headerHeight: number,
): boolean {
  if (currentY <= headerHeight) return false
  return remembered ?? hidden
}

export function headerHasBackground(scrollY: number): boolean {
  return scrollY > 0
}

export function shouldShowBackToTop(scrollY: number, viewportHeight: number): boolean {
  return scrollY > viewportHeight
}
