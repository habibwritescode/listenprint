import { useRef } from 'react'
import type { ReactNode } from 'react'
import { useHeaderScrollState } from '../hooks/useScrollVisibility.ts'

/**
 * Transparent at the very top, surface and hairline once scrolled, and translated out while scrolling down. Under
 * reduced motion it never hides, so there's no question of where its controls went.
 */
export function SiteHeader({ children }: { children: ReactNode }) {
  const headerRef = useRef<HTMLElement>(null)
  const { hidden, scrolled } = useHeaderScrollState(headerRef)

  return (
    <header
      ref={headerRef}
      data-testid="site-header"
      data-hidden={hidden ? '' : undefined}
      data-scrolled={scrolled ? '' : undefined}
      className="sticky top-0 z-20 -mx-4 flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 border-b border-transparent px-4 py-2.5 transition-[translate,background-color,border-color] duration-200 ease-settled data-scrolled:border-border data-scrolled:bg-surface motion-safe:data-hidden:not-focus-within:-translate-y-full sm:-mx-8 sm:px-8"
    >
      {children}
    </header>
  )
}
