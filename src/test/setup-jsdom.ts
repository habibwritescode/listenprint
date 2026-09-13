// jsdom logs "Not implemented" for window.scrollTo, which router scroll restoration and virtualizers call.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'scrollTo', { value: () => {}, configurable: true, writable: true })
}
