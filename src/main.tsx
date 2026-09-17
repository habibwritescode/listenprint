import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { createBrowserAuthSession } from './auth/browser.ts'
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx'
import { createBrowserViewTransition } from './navigation/browser.ts'
import { queryClient } from './query-client.ts'
import { createAppRouter } from './router.ts'
import { createBrowserLibrarySession } from './spotify/browser.ts'
import './index.css'

const auth = createBrowserAuthSession(window)
const library = createBrowserLibrarySession({ auth, queryClient, env: window })
// Before the router, so its popstate listener hears about a browser's own swipe animation first.
const viewTransition = createBrowserViewTransition(window)
const router = createAppRouter({ queryClient, auth, library, viewTransition })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AppErrorBoundary>
  </StrictMode>,
)
