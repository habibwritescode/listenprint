import { vi } from 'vitest'

interface StartOptions {
  update: () => unknown
  types?: string[]
}

/** One transition the router started, with what the page held when the browser would snapshot the new state. */
export interface RecordedTransition {
  types: string[]
  /** `--artist-tile` values in the new state, as the browser would capture them. */
  tiles: string[]
  heading: string | null
}

/**
 * A stand-in for `document.startViewTransition` in jsdom. It runs the router's update, then records the page as the
 * browser would capture it, so tests can check that the tile's destination was rendered in time. `CSS.supports` reports
 * view transition types, without which the router ignores our types and never asks.
 */
export function fakeViewTransitions() {
  const transitions: RecordedTransition[] = []
  const start = (options: StartOptions | (() => unknown)) => {
    const { update, types = [] } = typeof options === 'function' ? { update: options } : options
    const updateCallbackDone = Promise.resolve(update()).then(() => {
      transitions.push({
        types,
        tiles: [...document.querySelectorAll<HTMLElement>('[data-artist-tile]')].map((tile) =>
          tile.style.getPropertyValue('--artist-tile'),
        ),
        heading: document.querySelector('h1')?.textContent ?? null,
      })
    })
    return { updateCallbackDone, ready: updateCallbackDone, finished: updateCallbackDone, skipTransition: () => {} }
  }
  Object.defineProperty(document, 'startViewTransition', { value: start, configurable: true, writable: true })
  vi.stubGlobal('CSS', { supports: (condition: string) => condition === 'selector(:active-view-transition-type(a))' })

  return {
    transitions,
    restore: () => {
      Reflect.deleteProperty(document, 'startViewTransition')
      vi.unstubAllGlobals()
    },
  }
}
