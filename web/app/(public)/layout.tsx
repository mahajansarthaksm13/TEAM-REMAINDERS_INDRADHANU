import Link from "next/link"
import { cookies } from "next/headers"
import { hasSessionCookie } from "@/lib/shared"
import { PublicHeader } from "@/components/vb/public-header"
import { Wordmark } from "@/components/vb/brand"
import { CHECKPOINTS_REPO } from "@/lib/shared"

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const loggedIn = hasSessionCookie(await cookies())
  return (
    <>
      <PublicHeader loggedIn={loggedIn} />
      <main id="main">{children}</main>
      <footer className="dark-band no-print">
        <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-12 sm:px-6 md:grid-cols-12">
          <div className="md:col-span-5">
            <Wordmark />
            <p className="mt-3 max-w-sm text-sm text-sage-500">Grounded, exact, unhurried. Team REMAINDERS · PCCoE International Grand Challenge 2026 · AI for Climate Change.</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-2 text-sm md:col-span-7 md:grid-cols-3">
            {[["/live-data", "Live Data"], ["/ai-insights", "AI Insights"], ["/reports", "Reports"], ["/how-it-works", "How it works"], ["/checkpoints", "Checkpoints"], ["/about", "About"]].map(([h, l]) => (
              <Link key={h} href={h} className="py-1 text-garden-50/80 hover:text-garden-50">{l}</Link>
            ))}
            <a href={`https://github.com/${CHECKPOINTS_REPO}`} target="_blank" rel="noreferrer" className="py-1 text-garden-50/80 hover:text-garden-50">Checkpoints on GitHub ↗</a>
          </nav>
        </div>
        <p className="border-t border-olive-700/60 px-4 py-4 text-center text-xs text-sage-500">All times IST</p>
      </footer>
    </>
  )
}
