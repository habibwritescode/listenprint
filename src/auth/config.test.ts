import { describe, expect, it } from 'vitest'
import { loopbackUrl } from './config.ts'

describe('loopbackUrl', () => {
  it('moves a localhost page to 127.0.0.1, keeping port, path and query', () => {
    expect(loopbackUrl('http://localhost:5173/demo?mode=primary')).toBe('http://127.0.0.1:5173/demo?mode=primary')
  })

  it.each(['http://127.0.0.1:5173/', 'https://listenprint.vercel.app/'])('is null on %s, where sign-in works', (url) => {
    expect(loopbackUrl(url)).toBeNull()
  })
})
