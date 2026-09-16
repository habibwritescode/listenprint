// Written in sentence case and capitalized with CSS, so screen readers say words instead of spelling letters.
export function SampleDataChip() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.75 rounded-full border border-border bg-soft-highlight py-1 pr-2.5 pl-2 text-2xs tracking-[0.07em] text-highlight uppercase">
      <span aria-hidden className="size-1.5 rounded-full bg-highlight" />
      Sample data
    </span>
  )
}
