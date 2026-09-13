import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { demoLibraryQueryOptions } from '../demo/demo-library-query.ts'
import { generateDemoLibrary } from '../demo/generate.ts'
import { createAppRouter } from '../router.ts'

export const testLibrary = generateDemoLibrary({ trackCount: 300 })

export function renderApp(url: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(demoLibraryQueryOptions.queryKey, testLibrary)
  const router = createAppRouter({ queryClient, history: createMemoryHistory({ initialEntries: [url] }) })

  const view = render(createElement(QueryClientProvider, { client: queryClient }, createElement(RouterProvider, { router })))
  return { ...view, router, queryClient }
}
