import { useId } from 'react'
import type { ReactNode } from 'react'

/**
 * `product` is the app's own voice and appears only on the signed-out home; `attention` means something outside the
 * happy path is blocking you; `neutral` is status with nothing to fix. Cancelled vs. couldn't-verify is the pair
 * that needs the distinction: both end sign-in, but one was your choice.
 */
export type NoticeTone = 'product' | 'attention' | 'neutral'

const KICKER_TONE_CLASSES: Record<NoticeTone, string> = {
  product: 'text-bright-accent',
  attention: 'text-highlight',
  neutral: 'text-subtle',
}

const LAYOUT_CLASSES = {
  center: { section: 'items-center text-center', content: 'max-w-130', actions: 'justify-center' },
  start: { section: 'items-start text-left', content: 'max-w-155', actions: 'justify-start' },
} as const

interface NoticeProps {
  title: string
  body: ReactNode
  kicker?: string
  tone?: NoticeTone
  /** `start` for notices with real explaining to do; they get a wider measure. */
  align?: keyof typeof LAYOUT_CLASSES
  /** The signed-out home's larger headline. */
  hero?: boolean
  body2?: ReactNode
  /** A short literal, such as a path or an error message. */
  detail?: ReactNode
  meta?: string
  spinner?: boolean
  /** `status` for pending screens, so the wait is announced. */
  role?: 'status'
  /** Actions: links and buttons styled with `action-styles.ts`. */
  children?: ReactNode
}

export function Notice({
  title,
  body,
  kicker,
  tone = 'neutral',
  align = 'center',
  hero = false,
  body2,
  detail,
  meta,
  spinner = false,
  role,
  children,
}: NoticeProps) {
  const titleId = useId()
  const layout = LAYOUT_CLASSES[align]

  return (
    <section
      aria-labelledby={titleId}
      role={role}
      className={`flex min-h-100 flex-col justify-center px-2 py-13 sm:px-8.5 ${layout.section}`}
    >
      <div className={`w-full ${layout.content}`}>
        {kicker && (
          <p data-tone={tone} className={`mb-4 text-2xs tracking-[0.13em] uppercase ${KICKER_TONE_CLASSES[tone]}`}>
            {kicker}
          </p>
        )}
        {spinner && (
          <span
            data-slot="spinner"
            aria-hidden
            className={`mb-5.5 block size-5.5 animate-[spin_0.75s_linear_infinite] rounded-full border-2 border-accent border-t-transparent ${align === 'center' ? 'mx-auto' : ''}`}
          />
        )}
        <h1
          id={titleId}
          className={`leading-[1.1] font-[650] tracking-[-0.03em] text-balance ${hero ? 'text-4xl' : 'text-3xl'}`}
        >
          {title}
        </h1>
        <p className="mt-3.5 text-base leading-[1.62] text-pretty text-muted">{body}</p>
        {body2 && <p className="mt-3 text-base leading-[1.6] text-pretty text-subtle">{body2}</p>}
        {detail && (
          <p
            data-slot="detail"
            className="mt-4.5 inline-flex max-w-full items-center rounded-md border border-border bg-surface px-3 py-2 text-xs break-all text-muted tabular-nums select-all"
          >
            {detail}
          </p>
        )}
        {children && (
          <div data-slot="actions" className={`mt-6.5 flex flex-wrap gap-2.5 ${layout.actions}`}>
            {children}
          </div>
        )}
        {meta && (
          <p data-slot="meta" className="mt-6 text-2xs tracking-[0.07em] text-subtle uppercase tabular-nums">
            {meta}
          </p>
        )}
      </div>
    </section>
  )
}
