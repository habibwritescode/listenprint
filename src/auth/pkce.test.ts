import { describe, expect, it, vi } from 'vitest'
import { base64url, browserRandomBytes, codeChallengeS256, createCodeVerifier, createState } from './pkce.ts'

// RFC 7636 Appendix B: these 32 octets encode to the verifier below, whose S256 challenge is given.
const RFC_OCTETS = [
  116, 24, 223, 180, 151, 153, 224, 37, 79, 250, 96, 125, 216, 173, 187, 186, 22, 212, 37, 77, 105, 214, 191, 240,
  91, 88, 5, 88, 83, 132, 141, 121,
]
const RFC_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
const RFC_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'

// Expected encodings of sequentialBytes, generated once with Node's Buffer#toString('base64url') as an
// independent encoder (Node types aren't available to src/ tests).
const SEQUENTIAL_48 = '-h9EaY6z2P0iR2yRttsAJUpvlLneAyhNcpe84QYrUHWav-QJLlN4ncLnDDFWe6DF'
const SEQUENTIAL_16 = '-h9EaY6z2P0iR2yRttsAJQ'

function sequentialBytes(length: number) {
  return Uint8Array.from({ length }, (_, index) => (index * 37 + 250) % 256)
}

describe('base64url', () => {
  it('encodes the RFC 7636 example octets to its verifier', () => {
    expect(base64url(Uint8Array.from(RFC_OCTETS))).toBe(RFC_VERIFIER)
  })

  it('uses - and _ instead of + and /, with no padding', () => {
    expect(base64url(Uint8Array.from([0xfb, 0xff, 0xbf]))).toBe('-_-_')
    expect(base64url(Uint8Array.from([0xff]))).toBe('_w')
  })
})

describe('codeChallengeS256', () => {
  it('matches the RFC 7636 example challenge', async () => {
    expect(await codeChallengeS256(RFC_VERIFIER)).toBe(RFC_CHALLENGE)
  })
})

describe('createCodeVerifier', () => {
  it('encodes 48 random bytes as 64 base64url characters', () => {
    const randomBytes = vi.fn(sequentialBytes)

    const verifier = createCodeVerifier(randomBytes)

    expect(randomBytes).toHaveBeenCalledWith(48)
    expect(verifier).toBe(SEQUENTIAL_48)
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{64}$/)
  })

  it('differs between calls with real randomness', () => {
    expect(createCodeVerifier(browserRandomBytes)).not.toBe(createCodeVerifier(browserRandomBytes))
  })
})

describe('createState', () => {
  it('encodes 16 random bytes as 22 base64url characters', () => {
    const randomBytes = vi.fn(sequentialBytes)

    const state = createState(randomBytes)

    expect(randomBytes).toHaveBeenCalledWith(16)
    expect(state).toBe(SEQUENTIAL_16)
    expect(state).toMatch(/^[A-Za-z0-9_-]{22}$/)
  })
})

describe('browserRandomBytes', () => {
  it('returns the requested number of bytes', () => {
    expect(browserRandomBytes(48)).toHaveLength(48)
  })
})
