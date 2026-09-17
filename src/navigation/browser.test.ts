import { describe, expect, it } from 'vitest'
import { createBrowserViewTransition } from './browser.ts'
import type { ViewTransitionEnvironment } from './browser.ts'

const OPEN = { fromLocation: { pathname: '/demo' }, toLocation: { pathname: '/demo/artist/abc' } }

function fakeBrowser(overrides: Partial<ViewTransitionEnvironment> = {}) {
  const popstateListeners: Array<(event: { hasUAVisualTransition?: boolean }) => void> = []
  let reducedMotion = false
  const env: ViewTransitionEnvironment = {
    document: { startViewTransition: () => {} },
    CSS: { supports: (condition) => condition === 'selector(:active-view-transition-type(a))' },
    matchMedia: (query) => ({ matches: query === '(prefers-reduced-motion: reduce)' && reducedMotion }),
    addEventListener: (_type, listener) => {
      popstateListeners.push(listener)
    },
    ...overrides,
  }
  return {
    env,
    setReducedMotion: (value: boolean) => {
      reducedMotion = value
    },
    popstate: (hasUAVisualTransition?: boolean) => {
      for (const listener of popstateListeners) listener({ hasUAVisualTransition })
    },
  }
}

function typesFor(env: ViewTransitionEnvironment) {
  const option = createBrowserViewTransition(env)
  if (!option) throw new Error('expected view transitions to be on')
  return option.types
}

describe('createBrowserViewTransition', () => {
  it('animates list to artist navigations where the browser supports view transition types', () => {
    const types = typesFor(fakeBrowser().env)

    expect(types(OPEN)).toEqual(['artist-open'])
    expect(types({ fromLocation: { pathname: '/demo' }, toLocation: { pathname: '/demo' } })).toBe(false)
  })

  it('stays off without the View Transitions API', () => {
    expect(createBrowserViewTransition(fakeBrowser({ document: {} }).env)).toBe(false)
  })

  // Browsers that can't filter by type would otherwise cross-fade every navigation, mode toggles included.
  it('stays off where view transition types are unsupported', () => {
    expect(createBrowserViewTransition(fakeBrowser({ CSS: { supports: () => false } }).env)).toBe(false)
    expect(createBrowserViewTransition(fakeBrowser({ CSS: undefined }).env)).toBe(false)
  })

  it('skips the transition while reduced motion is requested, checked on every navigation', () => {
    const browser = fakeBrowser()
    const types = typesFor(browser.env)

    browser.setReducedMotion(true)
    expect(types(OPEN)).toBe(false)
    browser.setReducedMotion(false)
    expect(types(OPEN)).toEqual(['artist-open'])
  })

  it("lets a browser's own swipe-back animation stand alone, for that navigation only", () => {
    const browser = fakeBrowser()
    const types = typesFor(browser.env)
    const close = { fromLocation: { pathname: '/demo/artist/abc' }, toLocation: { pathname: '/demo' } }

    browser.popstate(true)
    expect(types(close)).toBe(false)
    expect(types(OPEN)).toEqual(['artist-open'])

    browser.popstate(false)
    expect(types(close)).toEqual(['artist-close'])
  })
})
