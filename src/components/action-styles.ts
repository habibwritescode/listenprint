const actionBase =
  'inline-flex h-9.5 items-center justify-center rounded-md px-4.25 text-md transition-colors disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-raised-surface disabled:font-normal disabled:text-subtle'

/** The one action a screen wants you to take. */
export const primaryActionClass = `${actionBase} bg-accent font-semibold text-on-accent hover:bg-accent/85`

/** An equal alternative to the primary action, like the demo beside sign-in. */
export const softActionClass = `${actionBase} border border-border bg-soft-accent font-[550] text-bright-accent hover:border-accent`

/** A way out that isn't the point of the screen. */
export const ghostActionClass = `${actionBase} border border-border text-muted hover:text-text`
