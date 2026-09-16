import { Notice } from '../components/Notice.tsx'

// Generation, not the network, is the slow part on weak devices.
export function DemoPagePending() {
  return (
    <Notice
      role="status"
      spinner
      title="Building the sample library…"
      body="Generating 10,000 tracks from a fixed seed. This runs in your browser and takes a moment on slower devices."
      meta="Everyone sees the same sample library"
    />
  )
}
