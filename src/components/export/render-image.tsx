import { toPng } from 'html-to-image'
import { createRoot } from 'react-dom/client'
import { ExportImage } from './ExportImage.tsx'
import type { ExportImageProps } from './ExportImage.tsx'

const SIZE = 1200

/**
 * Draws the square off-screen and converts it. It lives in its own chunk with `html-to-image`, so neither reaches
 * anyone who never exports.
 */
export async function renderExportImage(props: ExportImageProps): Promise<Blob> {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = `position:fixed;left:-${SIZE * 2}px;top:0;width:${SIZE}px;height:${SIZE}px;pointer-events:none`
  document.body.append(host)
  const root = createRoot(host)

  try {
    root.render(<ExportImage {...props} />)
    // Two frames: one for React to commit, one for the browser to lay the square out before it is captured.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    await document.fonts.ready
    const node = host.firstElementChild
    if (!(node instanceof HTMLElement)) throw new Error('The image layout did not render')
    const dataUrl = await toPng(node, { width: SIZE, height: SIZE, pixelRatio: 1 })
    return await (await fetch(dataUrl)).blob()
  } finally {
    root.unmount()
    host.remove()
  }
}
