import type { StorageLike } from '../auth/token-storage.ts'

export interface MemoryStorage extends StorageLike {
  entries(): Record<string, string>
}

export function createMemoryStorage(initial: Record<string, string> = {}): MemoryStorage {
  const items = new Map(Object.entries(initial))
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, String(value))
    },
    removeItem: (key) => {
      items.delete(key)
    },
    entries: () => Object.fromEntries(items),
  }
}
