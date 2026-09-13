import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactNode } from 'react'

export function renderWithRouter(ui: ReactNode) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => ui }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return { ...render(createElement(RouterProvider, { router })), router }
}
