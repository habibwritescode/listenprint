import { useBackToTopVisible } from '../hooks/useScrollVisibility.ts'

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
}

export function BackToTopButton() {
  const visible = useBackToTopVisible()
  if (!visible) return null

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
        // Keyboard and screen reader users land at the top too, instead of on a button that just unmounted.
        document.getElementById('content')?.focus({ preventScroll: true })
      }}
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex items-center gap-2 rounded-full border border-border bg-raised-surface px-4 py-2 text-sm font-semibold text-text shadow-2xl transition-colors hover:text-bright-accent"
    >
      <span aria-hidden>↑</span>
      Top
    </button>
  )
}
