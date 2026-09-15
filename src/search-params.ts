import { parseSearchWith, stringifySearchWith } from '@tanstack/react-router'

// The router's default JSON-parses search values, and JSON.parse silently rounds long digit strings:
// a Spotify `state` or `code` of "12345678901234567890" became 12345678901234567000 and failed the state
// check. A value is only parsed when it serializes back to exactly the same text; otherwise it stays a string.
function parseLossless(value: string): unknown {
  const parsed: unknown = JSON.parse(value)
  if (JSON.stringify(parsed) !== value) throw new SyntaxError('Search value does not round-trip through JSON')
  return parsed
}

export const parseSearch = parseSearchWith(parseLossless)

export const stringifySearch = stringifySearchWith(JSON.stringify, parseLossless)
