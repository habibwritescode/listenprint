import { artistTransitionTypes } from './view-transitions.ts'
import type { ArtistTransitionType, LocationChange } from './view-transitions.ts'

/** The parts of `window` view transitions depend on; `window` itself satisfies it. */
export interface ViewTransitionEnvironment {
  document: { startViewTransition?: unknown }
  CSS?: { supports(conditionText: string): boolean }
  matchMedia(query: string): { matches: boolean }
  addEventListener(
    type: 'popstate',
    listener: (event: { hasUAVisualTransition?: boolean }) => void,
    options?: { capture?: boolean },
  ): void
}

/** The router's `defaultViewTransition`: `false`, or the types to start each navigation's transition with. */
export type ViewTransitionSetting = false | { types: (change: LocationChange) => ArtistTransitionType[] | false }

/**
 * Where the browser can label transitions by type, animates list ↔ artist navigations. Browsers without types get
 * none at all: the router would otherwise start an untyped cross-fade on every navigation, mode toggles included.
 */
export function createBrowserViewTransition(env: ViewTransitionEnvironment): ViewTransitionSetting {
  const supported =
    typeof env.document.startViewTransition === 'function' &&
    env.CSS?.supports('selector(:active-view-transition-type(a))') === true
  if (!supported) return false

  // Set by a back or forward swipe the browser already animated (Safari, Chrome), so the page doesn't animate twice.
  let browserAnimated = false
  const recordSwipe = (event: { hasUAVisualTransition?: boolean }) => {
    browserAnimated = event.hasUAVisualTransition === true
  }
  env.addEventListener('popstate', recordSwipe, { capture: true })

  return {
    types: (change) => {
      const skip = browserAnimated || env.matchMedia('(prefers-reduced-motion: reduce)').matches
      browserAnimated = false
      return skip ? false : artistTransitionTypes(change)
    },
  }
}
