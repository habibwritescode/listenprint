import { useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import {
  headerHasBackground,
  headerHiddenOnArrival,
  isArrivalScroll,
  nextHeaderHidden,
  shouldShowBackToTop,
} from './scroll-visibility.ts'

/**
 * The header each history entry was left with, so Back restores it. Keyed by the key TanStack Router writes into
 * history state, and read from `history.state` rather than the router, since a scroll can outlive a navigation.
 */
const headerHiddenByEntry = new Map<string, boolean>()

function historyKey(): string {
  const state: unknown = window.history.state
  if (typeof state !== 'object' || state === null || !('key' in state)) return ''
  const { key } = state as { key: unknown }
  return typeof key === 'string' ? key : ''
}

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
      const key = historyKey()
      previousY = toY
      if (!arriving) pageChanged = false
      setHidden((wasHidden) => {
        const next = arriving
          ? headerHiddenOnArrival(headerHiddenByEntry.get(key), wasHidden, toY, headerHeight)
          : nextHeaderHidden(wasHidden, fromY, toY, headerHeight)
        headerHiddenByEntry.set(key, next)
        return next
      })
      setScrolled(headerHasBackground(toY))
      setInstant(arriving)
    }
    /*
     * Back and Forward restore the scroll position, but the scroll event that tells us about it lands after the
     * browser has captured the page a view transition animates to. Captured with the header it had on the page you
     * left, a hidden header was painted through the whole transition and snapped away at the end. popstate updates
     * history.state before any of that, so the entry's own header is in place before the capture.
     */
    const onPopState = () => {
      const remembered = headerHiddenByEntry.get(historyKey())
      if (remembered === undefined) return
      setHidden(remembered)
      setInstant(true)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('popstate', onPopState)
    return () => {
      for (const stop of unsubscribe) stop()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('popstate', onPopState)
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
