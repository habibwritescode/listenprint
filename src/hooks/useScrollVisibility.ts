import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { headerHasBackground, nextHeaderHidden, shouldShowBackToTop } from './scroll-visibility.ts'

export function useHeaderScrollState(headerRef: RefObject<HTMLElement | null>): { hidden: boolean; scrolled: boolean } {
  const [hidden, setHidden] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    let previousY = window.scrollY
    const onScroll = () => {
      const fromY = previousY
      const toY = window.scrollY
      const headerHeight = headerRef.current?.offsetHeight ?? 0
      previousY = toY
      setHidden((wasHidden) => nextHeaderHidden(wasHidden, fromY, toY, headerHeight))
      setScrolled(headerHasBackground(toY))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [headerRef])

  return { hidden, scrolled }
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
