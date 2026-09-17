import { useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import {
  headerHasBackground,
  headerHiddenAfterNavigation,
  isArrivalScroll,
  nextHeaderHidden,
  shouldShowBackToTop,
} from './scroll-visibility.ts'

interface HeaderScrollState {
  hidden: boolean
  scrolled: boolean
  /** The last change came from arriving on a page, so it should apply without the header's own transitions. */
  instant: boolean
}

export function useHeaderScrollState(headerRef: RefObject<HTMLElement | null>): HeaderScrollState {
  const [hidden, setHidden] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [instant, setInstant] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let previousY = window.scrollY
    // The scroll that resets or restores a new page's position is the router's, not someone scrolling: read as scrolling
    // down, Back to a list thousands of pixels down slid the header out and faded its background in over the rows as the
    // page arrived. Search-only changes (mode, sort) keep the page and its scroll, so they don't count.
    let pageChanged = false
    let renderedAt: number | null = null
    const unsubscribe = [
      router.subscribe('onBeforeNavigate', (event) => {
        if (!event.pathChanged) return
        pageChanged = true
        renderedAt = null
      }),
      router.subscribe('onRendered', () => {
        if (pageChanged && renderedAt === null) renderedAt = performance.now()
      }),
    ]
    const onScroll = () => {
      const fromY = previousY
      const toY = window.scrollY
      const headerHeight = headerRef.current?.offsetHeight ?? 0
      const arriving = isArrivalScroll(pageChanged, renderedAt, performance.now())
      previousY = toY
      if (!arriving) pageChanged = false
      setHidden((wasHidden) =>
        arriving
          ? headerHiddenAfterNavigation(wasHidden, toY, headerHeight)
          : nextHeaderHidden(wasHidden, fromY, toY, headerHeight),
      )
      setScrolled(headerHasBackground(toY))
      setInstant(arriving)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      for (const stop of unsubscribe) stop()
      window.removeEventListener('scroll', onScroll)
    }
  }, [headerRef, router])

  return { hidden, scrolled, instant }
}

export function useBackToTopVisible(): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(shouldShowBackToTop(window.scrollY, window.innerHeight))
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return visible
}
