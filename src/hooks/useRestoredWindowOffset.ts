import { useElementScrollRestoration } from '@tanstack/react-router'

/**
 * Where a window-virtualized list should start: the scroll position the router saved for this history entry, or the
 * current one. A window virtualizer scrolls the window to its starting offset when it mounts, so starting from the page's
 * position at first render would undo the router's restore after a reload or a back navigation.
 */
export function useRestoredWindowOffset(): number {
  const saved = useElementScrollRestoration({ getElement: () => window })
  return saved?.scrollY ?? window.scrollY
}
