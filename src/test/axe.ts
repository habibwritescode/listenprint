import axe from 'axe-core'

export async function expectNoAxeViolations(container: Element): Promise<void> {
  const { violations } = await axe.run(container, {
    // jsdom has no layout or canvas, so contrast can only be checked in a real browser.
    rules: { 'color-contrast': { enabled: false } },
  })
  if (violations.length === 0) return

  const report = violations
    .map((violation) => {
      const nodes = violation.nodes.map((node) => `    ${node.target.join(' ')}`).join('\n')
      return `  ${violation.id}: ${violation.help}\n${nodes}`
    })
    .join('\n')
  throw new Error(`Expected no accessibility violations, found ${violations.length}:\n${report}`)
}
