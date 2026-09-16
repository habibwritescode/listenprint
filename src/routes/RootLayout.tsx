import { Outlet } from '@tanstack/react-router'
import { BackToTopButton } from '../components/BackToTopButton.tsx'
import { SiteHeader } from '../components/SiteHeader.tsx'
import { HeaderIdentity } from '../components/auth/HeaderIdentity.tsx'

export function RootLayout() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-4 pb-6 sm:px-8">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-30 focus:rounded-sm focus:bg-accent focus:px-3 focus:py-2 focus:font-semibold focus:text-on-accent"
      >
        Skip to content
      </a>

      <SiteHeader>
        <HeaderIdentity />
      </SiteHeader>

      <main id="content" tabIndex={-1} className="flex-1 py-8 outline-none">
        <Outlet />
      </main>

      <BackToTopButton />
    </div>
  )
}
