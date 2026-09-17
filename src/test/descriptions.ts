/** The text of an element's `aria-describedby` targets, as a screen reader reads its description. */
export function describedBy(element: Element): string {
  const ids = element.getAttribute('aria-describedby')?.split(/\s+/) ?? []
  return ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ')
}
