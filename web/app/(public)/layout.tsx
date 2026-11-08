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
      <footer className="no-print neu-bar border-t">
        <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-12 sm:px-6 md:grid-cols-12">
          <div className="md:col-span-5">
            <Wordmark />
            <p className="mt-3 max-w-sm text-sm text-dim">Verifiable plastic collection for India&apos;s Extended Producer Responsibility rules: every kilogram signed at the bin and provable from a public ledger.</p>
            <p className="mt-3 text-xs text-dim">Team REMAINDERS · PCCoE International Grand Challenge 2026 · AI for Climate Change</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-2 text-sm md:col-span-7 md:grid-cols-3">
            {[["/live-data", "Live Data"], ["/simulator", "Simulator"], ["/ai-insights", "AI Insights"], ["/reports", "Reports"], ["/how-it-works", "How it works"], ["/checkpoints", "Checkpoints"], ["/about", "About"]].map(([h, l]) => (
              <Link key={h} href={h} className="py-1 text-ink/80 hover:text-ink">{l}</Link>
            ))}
            <a href={`https://github.com/${CHECKPOINTS_REPO}`} target="_blank" rel="noreferrer" className="py-1 text-ink/80 hover:text-ink">Checkpoints on GitHub ↗</a>
            <Link href={loggedIn ? "/app/live" : "/login"} className="py-1 font-semibold text-lit hover:underline">{loggedIn ? "Open dashboard" : "Log in"}</Link>
          </nav>
        </div>
        <p className="border-t border-line px-4 py-4 text-center text-xs text-dim">All times IST · Totals use approved catalogue weights · Demo scans never count</p>
      </footer>
    </>
  )
}
