import { describe, expect, it } from 'vitest'
import { SCROLL_TOLERANCE, headerHasBackground, nextHeaderHidden, shouldShowBackToTop } from './scroll-visibility.ts'

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
