import { queryOptions } from '@tanstack/react-query'

export const demoLibraryQueryOptions = queryOptions({
  queryKey: ['library', 'demo'],
  // Dynamic import keeps the generator and word lists out of the main bundle until /demo is visited.
  queryFn: async () => (await import('./generate.ts')).generateDemoLibrary(),
  // The demo is deterministic, so a generated library never goes stale.
  staleTime: Infinity,
  gcTime: Infinity,
})

export const demoGenresQueryOptions = queryOptions({
  queryKey: ['genres', 'demo'],
  queryFn: async () => (await import('./generate.ts')).generateDemoGenres(),
  staleTime: Infinity,
  gcTime: Infinity,
})

