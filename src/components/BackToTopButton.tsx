import { useBackToTopVisible } from '../hooks/useScrollVisibility.ts'

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
}

/**
 * Fixed to the viewport rather than parked after a list nobody scrolls to the end of, and 46px up so it clears the
 * iOS home indicator. At phone width it's a 46px circle over a scrim that keeps it legible above passing rows.
 */
export function BackToTopButton() {
  const visible = useBackToTopVisible()
  if (!visible) return null

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-10 h-[calc(env(safe-area-inset-bottom)+34px)] bg-linear-to-t from-background to-transparent min-[741px]:hidden"
      />
      <button
        type="button"
        onClick={() => {
          window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
          // Keyboard and screen reader users land at the top too, instead of on a button that just unmounted.
          document.getElementById('content')?.focus({ preventScroll: true })
        }}
        className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+46px)] z-20 flex size-11.5 items-center justify-center gap-2 rounded-full border border-border bg-raised-surface text-lg text-text shadow-[0_6px_20px_rgb(0_0_0/0.45)] transition-[opacity,border-color] duration-fade hover:border-accent starting:opacity-0 min-[741px]:h-9.5 min-[741px]:w-auto min-[741px]:px-3.5 min-[741px]:text-md"
      >
        <span aria-hidden>↑</span>
        <span className="max-[740px]:sr-only">Back to top</span>
      </button>
    </>
  )
}
