export type RandomBytes = (length: number) => Uint8Array

// Whole bytes encoded as base64url avoid the modulo bias of mapping bytes onto a character set.
const VERIFIER_BYTES = 48
const STATE_BYTES = 16

export const browserRandomBytes: RandomBytes = (length) => crypto.getRandomValues(new Uint8Array(length))

export function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export function createCodeVerifier(randomBytes: RandomBytes): string {
  return base64url(randomBytes(VERIFIER_BYTES))
}

export function createState(randomBytes: RandomBytes): string {
  return base64url(randomBytes(STATE_BYTES))
}

export async function codeChallengeS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(new Uint8Array(digest))
}
