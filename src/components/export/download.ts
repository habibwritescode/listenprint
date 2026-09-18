/** Hands a file to the browser. Injected in tests, which have no real object URLs to revoke. */
export type DownloadFile = (name: string, blob: Blob) => void

export function downloadFile(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  // Revoked straight away: the download has already taken its own reference to the blob.
  URL.revokeObjectURL(url)
}
