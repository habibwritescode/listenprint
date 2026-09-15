import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, onTestFinished } from 'vitest'
import { spotifyHandlers } from './spotify-handlers.ts'

export const server = setupServer(...spotifyHandlers)

export interface RecordedRequest {
  method: string
  url: string
  headers: Headers
  body: Promise<string>
}

/** Records every request made during the current test, including ones a handler rejects. */
export function recordRequests(): RecordedRequest[] {
  const requests: RecordedRequest[] = []
  const listener = ({ request }: { request: Request }) => {
    // Cloned before the handler reads the body.
    requests.push({ method: request.method, url: request.url, headers: request.headers, body: request.clone().text() })
  }
  server.events.on('request:start', listener)
  onTestFinished(() => {
    server.events.removeListener('request:start', listener)
  })
  return requests
}

/** Call once at the top of a test file that talks to Spotify. Per-test overrides reset after each test. */
export function setupSpotifyMocks() {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())
}
