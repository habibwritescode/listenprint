import { Link } from '@tanstack/react-router'
import { useRef } from 'react'
import type { ReactNode } from 'react'
import { useHeaderScrollState } from '../hooks/useScrollVisibility.ts'

const navLinkClass = 'text-muted transition-colors hover:text-text data-[status=active]:text-bright-accent'

/** `children` sit at the header's trailing edge, for route-specific controls. */
export function SiteHeader({ children }: { children?: ReactNode }) {
  const headerRef = useRef<HTMLElement>(null)
  const { hidden, scrolled } = useHeaderScrollState(headerRef)

  return (
    <header
      ref={headerRef}
      data-hidden={hidden ? '' : undefined}
      data-scrolled={scrolled ? '' : undefined}
      className="sticky top-0 z-20 -mx-4 flex items-center justify-between gap-4 border-b border-border px-4 py-4 transition-[translate,background-color] duration-200 data-hidden:not-focus-within:-translate-y-full data-scrolled:bg-background/90 data-scrolled:backdrop-blur motion-reduce:transition-none sm:-mx-8 sm:px-8"
    >
      <Link to="/" className="text-lg font-bold tracking-tight text-text">
        Listenprint
      </Link>
      {children}
      <nav aria-label="Primary">
        <ul className="flex gap-6 text-sm font-medium">
          <li>
            <Link to="/" activeOptions={{ exact: true }} className={navLinkClass}>
              Rankings
            </Link>
          </li>
          <li>
            <Link to="/demo" className={navLinkClass}>
              Demo
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  )
}
