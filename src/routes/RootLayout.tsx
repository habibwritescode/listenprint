import { Outlet } from '@tanstack/react-router'
import { BackToTopButton } from '../components/BackToTopButton.tsx'
import { SearchProvider } from '../components/SearchProvider.tsx'
import { SiteHeader } from '../components/SiteHeader.tsx'
import { HeaderContent } from '../components/HeaderContent.tsx'

export function RootLayout() {
  return (
    <SearchProvider>
      <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-4 pb-6 sm:px-8">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-4 focus:z-30 focus:rounded-md focus:bg-accent focus:px-3 focus:py-1.75 focus:text-sm focus:font-semibold focus:text-on-accent focus:shadow-[0_0_0_2px_var(--color-bright-accent)]"
        >
          Skip to content
        </a>

        <SiteHeader>
          <HeaderContent />
        </SiteHeader>

        <main id="content" tabIndex={-1} className="flex-1 py-8 outline-none">
          <Outlet />
        </main>

        <BackToTopButton />
      </div>
    </SearchProvider>
  )
}
