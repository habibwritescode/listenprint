// jsdom logs "Not implemented" for window.scrollTo, which router scroll restoration and virtualizers call.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'scrollTo', { value: () => {}, configurable: true, writable: true })

  // Lazy route chunks, IndexedDB-backed library loads and sign-in clearing can outlast findBy's default 1 s when every
  // test file runs in parallel; two tests failed intermittently that way on 2026-09-17.
  const { configure } = await import('@testing-library/react')
  configure({ asyncUtilTimeout: 3_000 })
}
