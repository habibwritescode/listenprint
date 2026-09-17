import { describe, expect, it } from 'vitest'
import {
  ARRIVAL_SETTLE_MS,
  SCROLL_TOLERANCE,
  headerHasBackground,
  headerHiddenAfterNavigation,
  isArrivalScroll,
  nextHeaderHidden,
  shouldShowBackToTop,
} from './scroll-visibility.ts'

const HEADER_HEIGHT = 64

describe('nextHeaderHidden', () => {
  it('keeps the header visible within its own height of the top', () => {
    expect(nextHeaderHidden(true, 100, 40, HEADER_HEIGHT)).toBe(false)
  })

  it('hides the header when scrolling down past it', () => {
    expect(nextHeaderHidden(false, 200, 260, HEADER_HEIGHT)).toBe(true)
  })

  it('shows the header again when scrolling up', () => {
    expect(nextHeaderHidden(true, 900, 880, HEADER_HEIGHT)).toBe(false)
  })

  it('ignores movements within the tolerance', () => {
    expect(nextHeaderHidden(true, 500, 500 - SCROLL_TOLERANCE, HEADER_HEIGHT)).toBe(true)
    expect(nextHeaderHidden(false, 500, 500 + SCROLL_TOLERANCE, HEADER_HEIGHT)).toBe(false)
  })
})

describe('isArrivalScroll', () => {
  it('counts scrolls between a page change and the new page rendering', () => {
    expect(isArrivalScroll(true, null, 5_000)).toBe(true)
  })

  it('counts scrolls shortly after the new page rendered, when the router restores the position', () => {
    expect(isArrivalScroll(true, 1_000, 1_000 + ARRIVAL_SETTLE_MS)).toBe(true)
  })

  // A page change that needed no scroll must not swallow someone's own scrolling later.
  it('stops counting once the new page has settled', () => {
    expect(isArrivalScroll(true, 1_000, 1_001 + ARRIVAL_SETTLE_MS)).toBe(false)
  })

  it('never counts scrolls without a page change', () => {
    expect(isArrivalScroll(false, 1_000, 1_000)).toBe(false)
  })
})

// Restoring a list's scroll position on Back is a jump, not someone scrolling, so it mustn't slide the header away.
describe('headerHiddenAfterNavigation', () => {
  it('keeps the header as it was when a page change scrolls far down', () => {
    expect(headerHiddenAfterNavigation(false, 3_000, HEADER_HEIGHT)).toBe(false)
    expect(headerHiddenAfterNavigation(true, 3_000, HEADER_HEIGHT)).toBe(true)
  })

  it('shows the header when a page change lands at the top', () => {
    expect(headerHiddenAfterNavigation(true, 0, HEADER_HEIGHT)).toBe(false)
    expect(headerHiddenAfterNavigation(true, HEADER_HEIGHT, HEADER_HEIGHT)).toBe(false)
  })
})

describe('headerHasBackground', () => {
  it('has no background at the top of the page, including overscroll above it', () => {
    expect(headerHasBackground(0)).toBe(false)
    expect(headerHasBackground(-12)).toBe(false)
  })

  it('has a background as soon as the page is scrolled', () => {
    expect(headerHasBackground(1)).toBe(true)
  })
})

describe('shouldShowBackToTop', () => {
  it('appears only after scrolling past one viewport height', () => {
    expect(shouldShowBackToTop(700, 768)).toBe(false)
    expect(shouldShowBackToTop(768, 768)).toBe(false)
    expect(shouldShowBackToTop(769, 768)).toBe(true)
  })
})
